import { map, OperatorFunction, pipe } from "rxjs";

export function withOptimistiqueId<T>() : OperatorFunction<T, T & {tempId: string}> {
  return pipe(
    map((data)=>({...data, tempId: 'temp-id-' + crypto.randomUUID()}))
  )
}
