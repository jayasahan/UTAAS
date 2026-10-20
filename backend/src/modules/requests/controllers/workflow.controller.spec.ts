import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowController } from './workflow.controller';
import { WorkflowStateMachineService } from '../services/workflow-state-machine.service';
import { WorkflowActionType } from '../dto/transition-action.dto';
import { UserRole } from '../../../database/entities/user.entity';

describe('WorkflowController', () => {
  let controller: WorkflowController;
  let mockWorkflowService: any;

  const mockUser = {
    id: 'user-hod-1',
    role: UserRole.HOD,
  } as any;

  beforeEach(async () => {
    mockWorkflowService = {
      executeTransition: jest.fn().mockResolvedValue({
        id: 'req-123',
        currentStageKey: 'DEAN',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkflowController],
      providers: [
        { provide: WorkflowStateMachineService, useValue: mockWorkflowService },
      ],
    }).compile();

    controller = module.get<WorkflowController>(WorkflowController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('executeAction', () => {
    it('should call workflowService.executeTransition and return result', async () => {
      const dto = { action: WorkflowActionType.APPROVE, comments: 'Recommended' };
      const res = await controller.executeAction('req-123', mockUser, dto);

      expect(mockWorkflowService.executeTransition).toHaveBeenCalledWith('req-123', mockUser, dto);
      expect(res.currentStageKey).toBe('DEAN');
    });
  });
});
