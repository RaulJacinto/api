import { IsOptional, IsString, MaxLength } from "class-validator";

export class HeartbeatDto {
  /** Identificador del dispositivo/cliente que late */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;

  /** Versión del cliente (ej: "api-0.3.1") */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  clientVersion?: string;
}
