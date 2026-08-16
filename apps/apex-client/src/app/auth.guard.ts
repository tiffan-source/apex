import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from "@angular/router";
import { SessionStore } from "../chore/stores/session.store";

export const authGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
    const router = inject(Router);
    const authService = inject(SessionStore);

    if (await authService.isAuthenticated()) {
      return true;
    }

    return router.createUrlTree(['/auth'])
};
