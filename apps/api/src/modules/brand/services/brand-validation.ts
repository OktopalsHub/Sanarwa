import { BadRequestException } from "@nestjs/common";
import { Brand } from "../entities/brand.entity";

export function validateDomainVerificationPrerequisites(brand: Brand, domain: string): void {
  const missingFields: string[] = [];

  if (!domain && !brand.domain) {
    missingFields.push("domain");
  }

  if (!brand.defaultFromEmail) {
    missingFields.push("defaultFromEmail");
  }

  if (!brand.defaultFromName) {
    missingFields.push("defaultFromName");
  }

  if (missingFields.length > 0) {
    throw new BadRequestException(
      `Domain verification requires the following fields to be set: ${missingFields.join(", ")}. ` +
        "Please update your brand configuration before attempting domain verification.",
    );
  }

  const emailDomain = brand.defaultFromEmail!.split("@")[1];
  const targetDomain = domain || brand.domain;

  if (emailDomain !== targetDomain) {
    throw new BadRequestException(
      `The default from email domain (${emailDomain}) must match the domain being verified (${targetDomain}). ` +
        "Please update your default from email or use a different domain.",
    );
  }
}

export function validateEmailVerificationPrerequisites(
  brand: Brand,
  verificationType: "DKIM" | "DMARC",
): void {
  const missingFields: string[] = [];

  if (!brand.domain) {
    missingFields.push("domain");
  }

  if (!brand.defaultFromEmail) {
    missingFields.push("defaultFromEmail");
  }

  if (!brand.defaultFromName) {
    missingFields.push("defaultFromName");
  }

  if (missingFields.length > 0) {
    throw new BadRequestException(
      `${verificationType} verification requires the following fields to be set: ${missingFields.join(", ")}. ` +
        "Please update your brand configuration before attempting verification.",
    );
  }

  const emailDomain = brand.defaultFromEmail!.split("@")[1];

  if (emailDomain !== brand.domain) {
    throw new BadRequestException(
      `The default from email domain (${emailDomain}) must match the brand domain (${brand.domain}). ` +
        "Please update your default from email or domain configuration.",
    );
  }
}
