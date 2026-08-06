import { ServiceBase } from "./base";
import wallstreetInexAirdropRegistrationSchema, {
  WallstreetInexAirdropRegistrationModel,
} from "../models/wallstreetInexAirdropRegistration";
import { WallstreetInexAirdropRegistration } from "../data/wallstreetInexAirdropRegistration";

export class WallstreetInexAirdropRegistrationService extends ServiceBase<
  WallstreetInexAirdropRegistration,
  WallstreetInexAirdropRegistrationModel
> {
  constructor() {
    super(
      wallstreetInexAirdropRegistrationSchema,
      "WallstreetInexAirdropRegistrations"
    );
  }
}

