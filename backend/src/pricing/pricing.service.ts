import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScalesService } from '../scales/scales.service';
import { CouponsService } from '../coupons/coupons.service';
import { PaymentsService } from '../payments/payments.service';
import type {
  PricingInput,
  PricingResult,
  VerifiedItem,
  CouponResult,
} from './pricing.types';

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class PricingService {
  constructor(
    private prisma: PrismaService,
    private scalesService: ScalesService,
    private couponsService: CouponsService,
    private paymentsService: PaymentsService,
  ) {}

  async calculateOrderPricing(input: PricingInput): Promise<PricingResult> {
    // Step 1: Verify items + resolve scale pricing
    const items = await this.verifyItems(input.items);
    const subtotal = roundCents(
      items.reduce((sum, i) => sum + i.lineTotal, 0),
    );

    // Step 2: Validate & calculate coupon discount
    const coupon = await this.applyCoupon(
      input.couponCode,
      subtotal,
      input.userId,
      items,
    );

    // Step 3: Resolve shipping
    const shipping = coupon.isFreeShipping ? 0 : input.shippingAmount;

    // Step 4: Calculate payment method discount (informational — stays on Payment)
    const paymentDiscount = input.paymentMethod
      ? this.paymentsService.calculateMethodDiscount(
          input.paymentMethod,
          subtotal,
        )
      : 0;

    // Step 5: Compute total (paymentDiscount NOT subtracted — it belongs to Payment)
    const total = roundCents(
      Math.max(subtotal - coupon.discount + shipping, 0),
    );

    return {
      items,
      subtotal,
      couponDiscount: coupon.discount,
      couponId: coupon.couponId,
      isFreeShipping: coupon.isFreeShipping,
      shipping,
      paymentDiscount,
      total,
    };
  }

  // ── Step 1: Verify items from DB + apply scale ──

  private async verifyItems(
    inputItems: PricingInput['items'],
  ): Promise<VerifiedItem[]> {
    const verified: VerifiedItem[] = [];

    for (const item of inputItems) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
        include: {
          variations: true,
          tags: true,
        },
      });

      if (!product) {
        throw new NotFoundException(`Product not found: ${item.productId}`);
      }
      if (!product.isActive) {
        throw new BadRequestException(
          `Product is not available: ${item.productId}`,
        );
      }

      // Resolve base price
      let basePrice: number;

      if (item.variationId) {
        const variation = product.variations?.find(
          (v: { id: string }) => v.id === item.variationId,
        );
        if (!variation) {
          throw new BadRequestException(
            `Variation not found: ${item.variationId}`,
          );
        }
        basePrice = variation.salePrice ?? variation.price;
      } else {
        basePrice = product.salePrice ?? product.basePrice;
      }

      // Resolve scale pricing
      let scalePercentage = 0;
      let unitPrice = basePrice;

      if (item.scaleId) {
        const ruleSet = await this.scalesService.resolveScaleRule(
          item.productId,
        );
        if (ruleSet) {
          const scaleItem = ruleSet.items.find(
            (i: { id: string }) => i.id === item.scaleId,
          );
          if (!scaleItem) {
            throw new BadRequestException(
              `Scale "${item.scaleId}" not found in product's scale rule`,
            );
          }
          scalePercentage = scaleItem.percentageIncrease;
          unitPrice = this.scalesService.calculateScalePrice(
            basePrice,
            scalePercentage,
          );
        }
        // If no ruleSet (product has noScales or no rule), ignore scale silently
      }

      verified.push({
        productId: item.productId,
        variationId: item.variationId,
        scaleId: item.scaleId,
        quantity: item.quantity,
        basePrice,
        scalePercentage,
        unitPrice,
        lineTotal: roundCents(unitPrice * item.quantity),
      });
    }

    return verified;
  }

  // ── Step 2: Apply coupon ──

  private async applyCoupon(
    couponCode: string | undefined,
    subtotal: number,
    userId: string,
    items: VerifiedItem[],
  ): Promise<CouponResult> {
    if (!couponCode) {
      return { discount: 0, isFreeShipping: false };
    }

    const result = await this.couponsService.validate({
      code: couponCode,
      cartValue: subtotal,
      userId,
    });

    // Validate category/tag restrictions against actual items
    if (result.categoryId) {
      const products = await Promise.all(
        items.map((i) =>
          this.prisma.product.findUnique({
            where: { id: i.productId },
            select: { categoryId: true },
          }),
        ),
      );
      const hasEligible = products.some(
        (p) => p?.categoryId === result.categoryId,
      );
      if (!hasEligible) {
        throw new BadRequestException(
          'No items in cart match the coupon category restriction',
        );
      }
    }

    if (result.tagId) {
      const products = await Promise.all(
        items.map((i) =>
          this.prisma.product.findUnique({
            where: { id: i.productId },
            include: { tags: true },
          }),
        ),
      );
      const hasEligible = products.some((p) =>
        p?.tags?.some((t: { id: string }) => t.id === result.tagId),
      );
      if (!hasEligible) {
        throw new BadRequestException(
          'No items in cart match the coupon tag restriction',
        );
      }
    }

    return {
      discount: result.discount,
      couponId: result.couponId,
      couponType: result.type,
      isFreeShipping: result.type === 'FREE_SHIPPING',
    };
  }
}
