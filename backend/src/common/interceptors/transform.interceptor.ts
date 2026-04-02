import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<any> {
    return next.handle().pipe(
      map((response: any) => {
        // Não transforma se não é objeto
        if (typeof response !== 'object' || response === null) {
          return { data: response };
        }

        // Já tem { data } → não re-wrapa
        if ('data' in response) {
          return response;
        }

        // Já tem { error } → não wrapa
        if ('error' in response) {
          return response;
        }

        return { data: response };
      }),
    );
  }
}
