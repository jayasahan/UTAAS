import { useState } from 'react';
import { Button } from '../components/common/Button';
import {
  Input,
  Select,
  Textarea,
  Checkbox,
} from '../components/common/FormControls';
import { Card } from '../components/common/Card';
import { Alert, Skeleton, EmptyState } from '../components/common/Feedback';
import { Dialog } from '../components/common/Dialog';
import { Table, TableHead, TableCell } from '../components/common/Table';
import { RequestStatusBadge } from '../components/tracking/RequestStatusBadge';
import type { RequestDisplayStatus } from '../components/tracking/RequestStatusBadge';
import { FormStepper, WorkflowStepper } from '../components/tracking/Steppers';
import { CorrectionBanner } from '../components/tracking/CorrectionBanner';

const steps = [
  { id: 'personal', label: 'Personal & Application' },
  { id: 'details', label: 'Claim Details' },
  { id: 'documents', label: 'Supporting Documents' },
  { id: 'review', label: 'Review & Submit' },
];
const statuses: RequestDisplayStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'RETURNED_FOR_CORRECTION',
  'APPROVED',
  'REJECTED',
  'SETTLED',
];

export function DesignSystemPage() {
  const [open, setOpen] = useState(false);
  const [currentStepId, setCurrentStepId] = useState('personal');
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-action">
          Development specimen
        </p>
        <h1 className="mt-2 text-display font-bold text-brand">
          UTAAS design system
        </h1>
        <p className="mt-3 text-muted">
          Presentation examples only. No application data or API integration.
        </p>
      </div>
      <Card>
        <h2 className="mb-4 text-2xl font-bold text-brand">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Continue</Button>
          <Button variant="secondary">Save draft</Button>
          <Button variant="success">Approve</Button>
          <Button variant="warning">Return for correction</Button>
          <Button variant="danger">Reject</Button>
          <Button variant="ghost">Cancel</Button>
          <Button pending>Saving</Button>
          <Button disabled>Unavailable</Button>
        </div>
      </Card>
      <Card>
        <h2 className="mb-4 text-2xl font-bold text-brand">Form controls</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Input
            label="Course code"
            required
            hint="Use the official course code."
          />
          <Select label="Semester">
            <option value="">Choose a semester</option>
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
          </Select>
          <Input
            label="Number of scripts"
            type="number"
            min={0}
            error="Enter a non-negative number."
          />
          <Input label="Staff ID" value="Example staff ID" readOnly />
          <Textarea label="Reviewer notes" />
          <Input
            label="Supporting document"
            type="file"
            accept=".pdf,.png"
            hint="File selection only; upload is not implemented."
          />
          <Checkbox label="I confirm that the information is accurate." />
        </div>
      </Card>
      <FormStepper
        steps={steps}
        currentStepId={currentStepId}
        onStepChange={setCurrentStepId}
      />
      <WorkflowStepper
        stages={[
          { id: 'submission', label: 'Lecturer', state: 'completed' },
          { id: 'hod', label: 'Head of Department', state: 'completed' },
          { id: 'dean', label: 'Dean', state: 'completed' },
          { id: 'exam', label: 'Examination Officer', state: 'active' },
          { id: 'finance', label: 'Financial Officer', state: 'pending' },
          { id: 'bursar', label: 'Assistant Bursar', state: 'pending' },
        ]}
      />
      <Card>
        <h2 className="mb-4 text-2xl font-bold text-brand">Request states</h2>
        <div className="flex flex-wrap gap-3">
          {statuses.map((status) => (
            <RequestStatusBadge key={status} status={status} />
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">
          Soft badges for officer queues
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {statuses.map((status) => (
            <RequestStatusBadge
              key={status}
              status={status}
              appearance="soft"
            />
          ))}
        </div>
      </Card>
      <CorrectionBanner
        reviewer="Example Examination Officer"
        reason="Verify the script count and supporting evidence."
        onEdit={() => setOpen(true)}
      />
      <Table caption="Example paper marking rows">
        <thead>
          <tr>
            <TableHead>Title of paper</TableHead>
            <TableHead colSpan={2} scope="colgroup">
              Marking scripts
            </TableHead>
          </tr>
          <tr>
            <TableHead scope="col">Course</TableHead>
            <TableHead>Number of scripts</TableHead>
            <TableHead>Amount (LKR)</TableHead>
          </tr>
        </thead>
        <tbody>
          <tr>
            <TableCell>Example course</TableCell>
            <TableCell>45</TableCell>
            <TableCell>Illustrative only</TableCell>
          </tr>
        </tbody>
      </Table>
      <Table variant="officer" caption="Officer queue header example">
        <thead>
          <tr>
            <TableHead>Reference</TableHead>
            <TableHead>Status</TableHead>
          </tr>
        </thead>
        <tbody>
          <tr>
            <TableCell>Illustrative only</TableCell>
            <TableCell>
              <RequestStatusBadge status="UNDER_REVIEW" appearance="soft" />
            </TableCell>
          </tr>
        </tbody>
      </Table>
      <Alert title="Example critical error" tone="danger" urgent>
        Changes could not be saved. Try again.
      </Alert>
      <Card>
        <h2 className="mb-4 text-2xl font-bold text-brand">Loading</h2>
        <Skeleton />
      </Card>
      <EmptyState title="No applications to display">
        This is an example empty state.
      </EmptyState>
      <Button onClick={() => setOpen(true)}>Open example dialog</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Example correction dialog"
        description="This does not execute a workflow action."
      >
        <Textarea label="Correction reason" />
        <div className="mt-6">
          <form method="dialog">
            <Button type="submit" variant="ghost">
              Native dismiss
            </Button>
          </form>
        </div>
      </Dialog>
    </div>
  );
}
