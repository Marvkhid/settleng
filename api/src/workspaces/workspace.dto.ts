import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty({ message: 'Please enter a name.' })
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsIn(['PERSONAL', 'BUSINESS'], { message: 'Choose a personal or business workspace.' })
  kind?: 'PERSONAL' | 'BUSINESS';
}

export class RenameWorkspaceDto {
  @IsString()
  @IsNotEmpty({ message: 'Please enter a name.' })
  @MaxLength(120)
  name!: string;
}

export class InviteMemberDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(160)
  email!: string;

  @IsIn(['MANAGER', 'STAFF'], { message: 'Choose manager or staff.' })
  role!: 'MANAGER' | 'STAFF';
}

export class ChangeRoleDto {
  @IsIn(['MANAGER', 'STAFF'], { message: 'Choose manager or staff.' })
  role!: 'MANAGER' | 'STAFF';
}
