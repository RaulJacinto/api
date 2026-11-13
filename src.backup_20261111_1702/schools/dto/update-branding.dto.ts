import {
  IsHexColor,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from "class-validator";

/**
 * Se puede enviar cualquier subconjunto.
 * Solo se actualiza lo presente en el body.
 */
export class UpdateBrandingDto {
  // ----- Escuela -----
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(256)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  // ----- Branding visual -----
  @IsOptional()
  @IsUrl({ require_tld: false })
  logoUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  treeLogoUrl?: string;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;
}
