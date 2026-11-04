export function paperStructureFixture() {
  return {
    exists: true,
    paperStructure: {
      id: 'structure-1',
      courseCode: 'EC5060',
      courseTitle: 'Software Engineering',
      academicYear: '2026',
      semester: '1',
      examType: 'Final',
      paperType: 'COMBINED',
      paperDurationHours: 3,
      totalQuestions: 5,
      totalMcqQuestions: 20,
      totalCandidates: 80,
      essayWeightPercent: '75.00',
      mcqWeightPercent: '25.00',
    },
    registeredBy: {
      name: 'Dr. Registrar',
      email: 'registrar@example.test',
      registeredAt: '2026-10-21T08:30:00.000Z',
    },
    claimsBreakdown: {
      setting: {
        totalQuestions: 5,
        claimedQuestions: 3,
        remainingQuestions: 2,
        isFullPaperClaimed: false,
        claimants: [
          {
            examinerId: 'other-examiner',
            examinerName: 'Other Examiner',
            examinerEmail: 'other@example.test',
            questionsClaimed: 3,
            proportion: 0.6,
            trackingNumber: 'UT-SETTING',
            status: 'UNDER_REVIEW',
          },
        ],
      },
      scriptMarking: {
        totalCandidates: 80,
        totalScriptsClaimed: 80,
        totalQuestionsMarked: 3,
        remainingQuestionsPerScript: 2,
        claimants: [
          {
            examinerName: 'Other Examiner',
            scriptsMarked: 80,
            questionsMarked: 3,
            trackingNumber: 'UT-MARKING',
          },
        ],
      },
      mcqSetting: {
        totalMcqQuestions: 20,
        claimedMcqQuestions: 0,
        remainingMcqQuestions: 20,
        claimants: [],
      },
      moderation: { isClaimed: true, claimedBy: 'Other Examiner' },
      typing: {
        isClaimed: true,
        typedPagesClaimed: 4,
        claimedBy: 'Other Examiner',
      },
      continuousAssessment: {
        maxAssessmentsPerStudent: 4,
        totalStudentAssessmentsClaimed: 0,
        maxTotalAssessmentsAllowed: 320,
      },
    },
  };
}
