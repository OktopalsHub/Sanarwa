import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Configuration } from './configuration.entity';

export enum VersionAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  ROLLBACK = 'rollback',
}

@Entity('configuration_versions')
@Index(['configurationId', 'version'])
@Index(['createdAt'])
export class ConfigurationVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'configuration_id' })
  configurationId: string;

  @Column({ type: 'int' })
  version: number;

  @Column('text', { nullable: true, name: 'previous_value' })
  previousValue?: string;

  @Column('text', { name: 'new_value' })
  newValue: string;

  @Column({
    type: 'enum',
    enum: VersionAction,
  })
  action: VersionAction;

  @Column({ nullable: true, length: 500, name: 'change_reason' })
  changeReason?: string;

  @Column({ nullable: true, name: 'changed_by' })
  changedBy?: string;

  @Column({ type: 'json', nullable: true, name: 'change_metadata' })
  changeMetadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Configuration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'configurationId' })
  configuration: Configuration;
}
