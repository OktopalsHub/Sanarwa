import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { SearchSortQueryDto } from "../../../common/dto/search-sort.dto";

export class UserQueryDto extends SearchSortQueryDto {}
