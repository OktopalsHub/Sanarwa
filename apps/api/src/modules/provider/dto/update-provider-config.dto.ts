import { PartialType } from "@nestjs/swagger";
import { CreateProviderConfigDto } from "./create-provider-config.dto";

export class UpdateProviderConfigDto extends PartialType(CreateProviderConfigDto) {}
