#!/bin/bash
set -e

# Enterprise Resource Generator
# Usage: ./scripts/generate-resource.sh <ResourceName>
# Example: ./scripts/generate-resource.sh Product

if [ -z "$1" ]; then
  echo "Usage: ./scripts/generate-resource.sh <ResourceName>"
  echo "Example: ./scripts/generate-resource.sh Product"
  exit 1
fi

RESOURCE_NAME="$1"
RESOURCE_LOWER=$(echo "$RESOURCE_NAME" | sed 's/\([A-Z]\)/-\L\1/g' | sed 's/^-//')
RESOURCE_DIR="src/modules/${RESOURCE_LOWER}s"
DTO_DIR="${RESOURCE_DIR}/dto"

echo "Generating resource: $RESOURCE_NAME"
echo "Directory: $RESOURCE_DIR"

# Create directories
mkdir -p "$DTO_DIR"

# Generate Create DTO
cat > "$DTO_DIR/create-${RESOURCE_LOWER}.dto.ts" << EOF
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class Create${RESOURCE_NAME}Dto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  // Add more fields as needed
}
EOF

# Generate Update DTO
cat > "$DTO_DIR/update-${RESOURCE_LOWER}.dto.ts" << EOF
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class Update${RESOURCE_NAME}Dto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  // Add more fields as needed
}
EOF

# Generate DTO index
cat > "$DTO_DIR/index.ts" << EOF
export * from './create-${RESOURCE_LOWER}.dto';
export * from './update-${RESOURCE_LOWER}.dto';
EOF

# Generate Service
cat > "$RESOURCE_DIR/${RESOURCE_LOWER}s.service.ts" << EOF
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dtos';
import { buildPaginatedResult, buildPrismaQueryOptions } from '../../common/utils';
import { buildSoftDeleteFilter } from '../../database/helpers';
import { Create${RESOURCE_NAME}Dto, Update${RESOURCE_NAME}Dto } from './dto';

@Injectable()
export class ${RESOURCE_NAME}sService {
  private readonly logger = new Logger(${RESOURCE_NAME}sService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto) {
    const { skip, take, orderBy } = buildPrismaQueryOptions(query);
    const where = buildSoftDeleteFilter();

    // TODO: Add Prisma model query
    // const [items, total] = await Promise.all([
    //   this.prisma.${RESOURCE_LOWER}.findMany({ where, skip, take, orderBy }),
    //   this.prisma.${RESOURCE_LOWER}.count({ where }),
    // ]);

    // return buildPaginatedResult(items, query, total);
    return { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } };
  }

  async findOne(id: string) {
    // TODO: Implement with Prisma model
    throw new NotFoundException('${RESOURCE_NAME} not found');
  }

  async create(dto: Create${RESOURCE_NAME}Dto) {
    // TODO: Implement with Prisma model
    this.logger.log('${RESOURCE_NAME} created');
    return dto;
  }

  async update(id: string, dto: Update${RESOURCE_NAME}Dto) {
    await this.findOne(id);
    // TODO: Implement with Prisma model
    this.logger.log('${RESOURCE_NAME} updated: ' + id);
    return dto;
  }

  async remove(id: string) {
    await this.findOne(id);
    // TODO: Implement soft delete with Prisma model
    this.logger.log('${RESOURCE_NAME} deleted: ' + id);
    return { message: '${RESOURCE_NAME} deleted successfully' };
  }
}
EOF

# Generate Controller
cat > "$RESOURCE_DIR/${RESOURCE_LOWER}s.controller.ts" << EOF
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ${RESOURCE_NAME}sService } from './${RESOURCE_LOWER}s.service';
import { Create${RESOURCE_NAME}Dto, Update${RESOURCE_NAME}Dto } from './dto';
import { PaginationQueryDto } from '../../common/dtos';

@ApiTags('${RESOURCE_NAME}s')
@ApiBearerAuth()
@Controller('${RESOURCE_LOWER}s')
export class ${RESOURCE_NAME}sController {
  constructor(private readonly service: ${RESOURCE_NAME}sService) {}

  @Get()
  @ApiOperation({ summary: 'Get all ${RESOURCE_LOWER}s' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ${RESOURCE_LOWER} by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create ${RESOURCE_LOWER}' })
  create(@Body() dto: Create${RESOURCE_NAME}Dto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update ${RESOURCE_LOWER}' })
  update(@Param('id') id: string, @Body() dto: Update${RESOURCE_NAME}Dto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete ${RESOURCE_LOWER}' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
EOF

# Generate Module
cat > "$RESOURCE_DIR/${RESOURCE_LOWER}s.module.ts" << EOF
import { Module } from '@nestjs/common';
import { ${RESOURCE_NAME}sService } from './${RESOURCE_LOWER}s.service';
import { ${RESOURCE_NAME}sController } from './${RESOURCE_LOWER}s.controller';

@Module({
  controllers: [${RESOURCE_NAME}sController],
  providers: [${RESOURCE_NAME}sService],
  exports: [${RESOURCE_NAME}sService],
})
export class ${RESOURCE_NAME}sModule {}
EOF

# Generate Test
cat > "$RESOURCE_DIR/${RESOURCE_LOWER}s.service.spec.ts" << EOF
import { Test, TestingModule } from '@nestjs/testing';
import { ${RESOURCE_NAME}sService } from './${RESOURCE_LOWER}s.service';
import { PrismaService } from '../../database/prisma.service';

describe('${RESOURCE_NAME}sService', () => {
  let service: ${RESOURCE_NAME}sService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ${RESOURCE_NAME}sService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<${RESOURCE_NAME}sService>(${RESOURCE_NAME}sService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
EOF

echo ""
echo "Resource '$RESOURCE_NAME' generated successfully!"
echo ""
echo "Next steps:"
echo "1. Add the Prisma model to prisma/schema.prisma"
echo "2. Run: npx prisma migrate dev --name add-${RESOURCE_LOWER}"
echo "3. Import ${RESOURCE_NAME}sModule in src/app.module.ts"
echo "4. Complete the TODO items in the generated service"
