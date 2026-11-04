import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SessionContext } from '../../auth/session';
import type { ApiClient } from '../../services/apiClient';
import { currentCircularFixture } from '../../test/circularRatesFixture';
import { decodeCircular } from '../../auth/contracts';
import { createForm, createPaper } from './model';
import { verifiedRatesFromCircular } from './estimates';
import { PaymentTable } from './components/PaymentTable';
import { ReviewStep } from './components/ReviewStep';
import { PaperMarkingClaimPage } from './PaperMarkingClaimPage';
import { syntheticOfficerReview } from '../officer-review/developmentFixture';
import { decodeOfficerClaimReview } from '../officer-review/contracts';
import { OfficerClaimReviewView } from '../officer-review/OfficerClaimReviewView';

const rates = verifiedRatesFromCircular(decodeCircular(currentCircularFixture));
const paper = {
  ...createPaper('one'),
  settingCount: '1',
  scriptCount: '10',
  assessmentQuantity: '3',
};

describe('payment estimate presentation and server authority', () => {
  it('renders estimates from the current response in the payment table', () => {
    render(
      <PaymentTable
        papers={[paper]}
        {...(rates ? { rates } : {})}
        errors={[]}
        onChange={vi.fn()}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText(/TOTAL PAYMENT ESTIMATE:/)).toHaveTextContent(
      '2,500.00',
    );
    expect(
      screen.getByText(/Setting uses the standard per-paper rate/),
    ).toBeVisible();
    expect(
      screen.getByText(
        /Server-confirmed payment breakdowns and totals remain authoritative/,
      ),
    ).toBeVisible();
  });

  it('renders supported preparation while an hourly total remains explicitly unavailable', () => {
    render(
      <PaymentTable
        papers={[{ ...paper, assessmentUnit: 'hours' }]}
        {...(rates ? { rates } : {})}
        errors={[]}
        onChange={vi.fn()}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText(/TOTAL PAYMENT ESTIMATE:/)).toHaveTextContent(
      'Unavailable',
    );
    expect(
      screen.getByText(/Hour-based assessment estimates are unavailable/),
    ).toBeVisible();
    expect(
      within(screen.getByRole('table')).getByText(/1,200.00/),
    ).toBeVisible();
  });

  it('uses the same compatibility and unsupported-unit behavior in review', () => {
    const form = createForm();
    form.papers = [paper];
    const view = render(
      <ReviewStep
        form={form}
        {...(rates ? { rates } : {})}
        errors={[]}
        onEdit={vi.fn()}
        onDeclaration={vi.fn()}
      />,
    );
    expect(screen.getByText(/^Total estimate:/)).toHaveTextContent('2,500.00');
    view.rerender(
      <ReviewStep
        form={{ ...form, papers: [{ ...paper, assessmentUnit: 'hours' }] }}
        {...(rates ? { rates } : {})}
        errors={[]}
        onEdit={vi.fn()}
        onDeclaration={vi.fn()}
      />,
    );
    expect(screen.getByText(/^Total estimate:/)).toHaveTextContent(
      'Unavailable',
    );
    expect(screen.getByText(/does not provide an hourly rate/)).toBeVisible();
  });

  it('keeps a restored server total authoritative even when the local estimate differs', async () => {
    const user = userEvent.setup({ delay: null });
    const formData = {
      personal: {
        fullName: 'Test Lecturer',
        designation: 'Lecturer',
        department: 'ENG',
        staffId: 'TEST-1',
      },
      metadata: {
        academicYear: '2026',
        semester: 'Semester 1',
        degreeProgramme: 'BSc',
        courseCode: 'EC5060',
        courseTitle: 'Software Engineering',
        examType: 'Final',
        examinerRole: 'First Examiner',
      },
      papers: [{ ...paper, durationHours: '3' }],
      supportingDocuments: [],
      declaration: false,
    };
    const client: ApiClient = {
      get: vi.fn(async (path, decode) => {
        if (path === '/auth/me')
          return decode({
            id: 'lecturer-1',
            fullName: 'Test Lecturer',
            email: 'lecturer@example.test',
            role: 'LECTURER',
            departmentCode: 'ENG',
            departmentId: 'department-1',
          });
        if (path.endsWith('/rates/circular'))
          return decode(currentCircularFixture);
        return decode({
          id: 'saved',
          trackingNumber: 'UT-SAVED',
          status: 'DRAFT',
          totalAmount: 9876.54,
          formData,
        });
      }),
      post: vi.fn(),
      upload: vi.fn(),
    };
    render(
      <SessionContext.Provider
        value={{ status: 'authenticated', message: '', client, version: 1 }}
      >
        <MemoryRouter initialEntries={['/requests/new?draftId=saved']}>
          <PaperMarkingClaimPage />
        </MemoryRouter>
      </SessionContext.Provider>,
    );
    await screen.findByDisplayValue('Test Lecturer');
    expect(
      await screen.findByText(/Server-calculated total:/),
    ).toHaveTextContent('9,876.54');
    await user.click(screen.getByRole('button', { name: 'Continue →' }));
    expect(screen.getByText(/TOTAL PAYMENT ESTIMATE:/)).toHaveTextContent(
      '2,500.00',
    );
    expect(screen.getByText(/Server-calculated total:/)).toHaveTextContent(
      '9,876.54',
    );
    expect(client.post).not.toHaveBeenCalled();
  });

  it('displays returned fee lines and the server total without deriving them from circular rates', () => {
    const serverLine = {
      key: 'SERVER_ONLY_FEE',
      label: 'Server-confirmed fee',
      unit: 'server unit',
      rate: 17.25,
      count: 2,
      subtotal: 34.5,
    };
    const fixture = syntheticOfficerReview;
    const review = decodeOfficerClaimReview(
      {
        id: fixture.id,
        trackingNumber: fixture.trackingNumber,
        status: fixture.status,
        currentStageKey: fixture.currentStageKey,
        createdAt: fixture.submittedAt,
        totalAmount: 9999,
        formData: {
          papers: [],
          feeCalculation: { items: [serverLine], totalAmount: 9999 },
        },
      },
      { ...fixture.tracking, totalAmount: 9999 },
      fixture.history,
      fixture.reviewerRole,
    );
    expect(review.feeLines).toEqual([serverLine]);
    render(
      <MemoryRouter>
        <OfficerClaimReviewView review={review} actionsEnabled={false} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Server-confirmed fee')).toBeVisible();
    expect(screen.getByText(/Server-confirmed total:/)).toHaveTextContent(
      '9,999.00',
    );
    const table = screen.getByRole('table', {
      name: 'Server-confirmed fee lines',
    });
    expect(within(table).getByText(/17.25/)).toHaveTextContent('server unit');
    expect(within(table).getByText(/34.50/)).toBeVisible();
  });
});
