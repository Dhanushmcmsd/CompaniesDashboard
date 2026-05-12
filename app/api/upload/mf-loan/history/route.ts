import { NextResponse }   from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions }     from '@/lib/auth';
import { prisma }          from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['EMPLOYEE', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const items = await prisma.uploadBatch.findMany({
      where:   { company: 'supra', portfolio: 'mf-loan' },
      orderBy: { uploadedAt: 'desc' },
      take:    20,
      select: {
        id:           true,
        fileType:     true,
        originalName: true,
        reportDate:   true,
        rowCount:     true,
        status:       true,
        uploadedBy:   true,
        uploadedAt:   true,
        errors:       true,
      },
    });

    return NextResponse.json({ items }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: `Server error: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
