import { SetMetadata } from '@nestjs/common';

export const OWNERSHIP_KEY = 'ownership';

/**
 * Decorator que define qual param da URL contém o userId do dono do recurso.
 * Usado com OwnershipGuard para prevenir IDOR.
 *
 * Exemplo: @CheckOwnership('userId') em um endpoint GET /users/:userId/orders
 * O guard compara request.params.userId com request.user.id
 * Admin bypassa automaticamente.
 */
export const CheckOwnership = (paramKey: string) =>
  SetMetadata(OWNERSHIP_KEY, paramKey);
