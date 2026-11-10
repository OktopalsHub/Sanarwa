import { PartialType, PickType } from "@nestjs/mapped-types";
import { CreateTemplateDto } from "./create-template.dto";

export class UpdateTemplateDto extends PartialType(
  PickType(CreateTemplateDto, [
    "name",
    "description",
    "data",
    "subject",
    "channel",
    "variables",
    "styling",
    "channelSpecific",
    "metadata",
  ]),
) {}
