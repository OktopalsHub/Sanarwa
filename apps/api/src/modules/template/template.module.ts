import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Template } from "./template.entity";
import { TemplateService } from "./template.service";

@Module({
  imports: [TypeOrmModule.forFeature([Template])],
  providers: [TemplateService],
  exports: [TemplateService, TypeOrmModule],
})
export class TemplateModule {}
