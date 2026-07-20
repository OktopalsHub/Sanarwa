import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StructuredLoggerService } from '../structured-logger.service';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class LogRotationService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async rotateLogFiles() {
    const logFileEnabled = this.configService.get('logging.file.enabled');
    if (!logFileEnabled) {
      return;
    }

    const logFilePath = this.configService.get('logging.file.path');
    const maxFiles = this.configService.get('logging.file.maxFiles', 5);

    try {
      await this.performRotation(logFilePath, maxFiles);
      this.logger.log('Log rotation completed successfully', {
        operation: 'log_rotation',
        logFilePath,
        maxFiles,
      });
    } catch (error) {
      this.logger.error('Log rotation failed', error.stack, {
        operation: 'log_rotation',
        logFilePath,
        error: error.message,
      });
    }
  }

  private async performRotation(logFilePath: string, maxFiles: number) {
    const logDir = path.dirname(logFilePath);
    const logFileName = path.basename(logFilePath, path.extname(logFilePath));
    const logFileExt = path.extname(logFilePath);

    // Check if current log file exists
    try {
      await fs.access(logFilePath);
    } catch {
      // Log file doesn't exist, nothing to rotate
      return;
    }

    // Get file stats to check if rotation is needed
    const stats = await fs.stat(logFilePath);
    const maxSize = this.parseSize(this.configService.get('logging.file.maxSize', '10m'));
    
    if (stats.size < maxSize) {
      // File is not large enough to rotate
      return;
    }

    // Rotate existing numbered files
    for (let i = maxFiles - 1; i >= 1; i--) {
      const currentFile = path.join(logDir, `${logFileName}.${i}${logFileExt}`);
      const nextFile = path.join(logDir, `${logFileName}.${i + 1}${logFileExt}`);

      try {
        await fs.access(currentFile);
        if (i === maxFiles - 1) {
          // Delete the oldest file
          await fs.unlink(currentFile);
        } else {
          // Move to next number
          await fs.rename(currentFile, nextFile);
        }
      } catch {
        // File doesn't exist, continue
      }
    }

    // Move current log file to .1
    const firstRotatedFile = path.join(logDir, `${logFileName}.1${logFileExt}`);
    await fs.rename(logFilePath, firstRotatedFile);

    // Compress the rotated file
    await this.compressFile(firstRotatedFile);
  }

  private async compressFile(filePath: string) {
    try {
      const zlib = await import('zlib');
      const { createReadStream, createWriteStream } = await import('fs');
      const { pipeline } = await import('stream/promises');

      const gzipPath = `${filePath}.gz`;
      const readStream = createReadStream(filePath);
      const writeStream = createWriteStream(gzipPath);
      const gzipStream = zlib.createGzip();

      await pipeline(readStream, gzipStream, writeStream);

      // Remove original file after compression
      await fs.unlink(filePath);

      this.logger.log('Log file compressed', {
        operation: 'log_compression',
        originalFile: filePath,
        compressedFile: gzipPath,
      });
    } catch (error) {
      this.logger.warn('Failed to compress log file', {
        operation: 'log_compression',
        filePath,
        error: error.message,
      });
    }
  }

  private parseSize(sizeStr: string): number {
    const units = {
      b: 1,
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024,
    };

    const match = sizeStr.toLowerCase().match(/^(\d+)([bkmg]?)$/);
    if (!match) {
      throw new Error(`Invalid size format: ${sizeStr}`);
    }

    const [, size, unit] = match;
    return parseInt(size) * (units[unit as keyof typeof units] || 1);
  }

  async getLogFileStats() {
    const logFileEnabled = this.configService.get('logging.file.enabled');
    if (!logFileEnabled) {
      return { enabled: false };
    }

    const logFilePath = this.configService.get('logging.file.path');
    const logDir = path.dirname(logFilePath);

    try {
      const files = await fs.readdir(logDir);
      const logFiles = files.filter(file => 
        file.startsWith(path.basename(logFilePath, path.extname(logFilePath)))
      );

      const fileStats = await Promise.all(
        logFiles.map(async (file) => {
          const filePath = path.join(logDir, file);
          const stats = await fs.stat(filePath);
          return {
            name: file,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
          };
        })
      );

      return {
        enabled: true,
        logDir,
        files: fileStats,
        totalSize: fileStats.reduce((sum, file) => sum + file.size, 0),
      };
    } catch (error) {
      return {
        enabled: true,
        error: error.message,
      };
    }
  }
}