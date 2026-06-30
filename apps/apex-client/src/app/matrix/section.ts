import { inject } from "@angular/core";
import { MatrixServices } from "./matrix.services";

export class Section {
  protected readonly matrixService = inject(MatrixServices);


}
