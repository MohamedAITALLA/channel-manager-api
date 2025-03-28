import { PartialType } from '@nestjs/swagger';
import { CreateICalConnectionDto } from './create-ical-connection.dto';

export class UpdateICalConnectionDto extends PartialType(CreateICalConnectionDto) {}
