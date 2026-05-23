import { NextResponse }      from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions }      from '@/lib/auth';
import { prisma }           from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !['EMPLOYEE', 'ADMIN', 'MANAGEMENT'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const batches = await prisma.uploadBatch.findMany({
    where:   { portfolio: 'mf-loan', company: 'supra' },
    orderBy: { uploadedAt: 'desc' },
    take:    50,
    select: {
      id:           true,
      originalName: true,
      fileType:     true,
      rowCount:     true,
      status:       true,
      errors:       true,
      uploadedBy:   true,
      uploadedAt:   true,
      reportDate:   true,
      parseMeta:    true,
    },
  });

  return NextResponse.json({ batches });
}
