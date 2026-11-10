import { Provider, Type } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ObjectLiteral, Repository } from "typeorm";
import { BaseRepository } from "./base.repository";

export function provideBaseRepository<T extends ObjectLiteral>(
  entity: Type<T>,
  token: string | symbol,
): Provider {
  return {
    provide: token,
    useFactory: (repo: Repository<T>) => new BaseRepository(repo),
    inject: [getRepositoryToken(entity)],
  };
}
