import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { SearchSortQueryDto } from "../../../common/dto/search-sort.dto";
import { ProjectStatus } from "../../../common/enums";

export class ProjectQueryDto extends SearchSortQueryDto {
  @ApiPropertyOptional({
    description: "Filter by project status",
    enum: ProjectStatus,
    example: ProjectStatus.ACTIVE,
    type: String,
  })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}
