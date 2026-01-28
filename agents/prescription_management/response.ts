/* eslint-disable complexity */
import { getAgentResponse } from '@core/agent'
import { GenerateAgentResponseSpecification, AgentId, MessageSender, FlowInput, PrescriptionFlowStep } from 'types'
import { WidgetType } from 'types/widget'
import { PrescriptionManagementResponse } from '.'

// Default fallback data for testing when token payload doesn't include prescription data
const DEFAULT_PRESCRIPTION_DATA = {
  preselectedPharmacyId: 'cvs',
  prescribedMedications: [{ name: 'Amoxicillin', description: '500 mg, 10-day supply' }],
  chronicMedications: [{ name: 'Metformin', description: '500 mg tablet' }],
}

export const generateAgentResponse: GenerateAgentResponseSpecification = async ({
  agent,
  sessionData,
  lastAgentUnsentMessage,
}: FlowInput) => {
  const { chatState, chatContext } = sessionData
  const currentStep = chatState.prescriptionFlowStep
  const lastMessage = sessionData.messages.length > 0 ? sessionData.messages[sessionData.messages.length - 1] : null
  const messageWidget = lastMessage?.metadata?.widget

  // Extract prescription data from session or use defaults
  const prescriptionData = chatContext.prescriptionData ?? DEFAULT_PRESCRIPTION_DATA
  const userSelectedPharmacyId = prescriptionData.preselectedPharmacyId
  const prescribedMedications = prescriptionData.prescribedMedications
  const chronicMedications = prescriptionData.chronicMedications ?? []
  const hasChronicMedications = chronicMedications.length > 0

  // Helper to format medication for display
  const formatMedication = (med: { name: string; description: string }) => `${med.name} ${med.description}`
  const primaryMedication = prescribedMedications[0]
  const primaryChronicMed = chronicMedications[0]

  // ─────────────────────────────────────────────────────────────────────────────
  // FREE-TEXT DETECTION: Let LLM handle user questions during active flow
  // ─────────────────────────────────────────────────────────────────────────────
  const hasWidgetToAssistant =
    messageWidget && 'toAssistant' in messageWidget && messageWidget.toAssistant !== undefined
  const isUserMessage = lastMessage?.metadata?.source === MessageSender.USER

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: goal_achieved
  // Flow has finished, but stay in prescription_management to allow status inquiries
  // ─────────────────────────────────────────────────────────────────────────────

  // If user sent a free-text message while in an active step, let LLM handle it
  if (isUserMessage && !hasWidgetToAssistant && currentStep) {
    const res = (await getAgentResponse({
      agent,
      sessionData,
      lastAgentUnsentMessage,
    })) as PrescriptionManagementResponse

    return {
      newChatState: chatState, // Keep the same step - don't advance
      chatbotMessage: res.chatbotMessage,
      goalAchieved: false,
      nextAgentId: AgentId.PRESCRIPTION_MANAGEMENT,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: awaiting_pharmacy_selection (Path 1)
  // User just selected CVS or Amazon from PharmacyComparison widget
  // ─────────────────────────────────────────────────────────────────────────────
  if (currentStep === 'awaiting_pharmacy_selection') {
    if (messageWidget?.type === WidgetType.PHARMACY_COMPARISON && messageWidget.toAssistant) {
      const { selectedPharmacyId } = messageWidget.toAssistant
      let chatbotMessage =
        selectedPharmacyId === 'amazon'
          ? `Ok, you've chosen to switch to Amazon for your ${formatMedication(primaryMedication)}.`
          : `Ok, you've chosen to stay with CVS for your ${formatMedication(primaryMedication)}.`

      // Check if chronic medications exist → prompt for chronic medication
      if (hasChronicMedications) {
        chatbotMessage += ` I also see you're taking ${primaryChronicMed.name}. You could switch that to Amazon Pharmacy as well:`

        return Promise.resolve({
          newChatState: {
            ...chatState,
            prescriptionFlowStep: 'awaiting_chronic_medication_interest' as PrescriptionFlowStep,
          },
          chatbotMessage,
          messageMetadata: {
            source: MessageSender.ASSISTANT,
            widget: {
              type: WidgetType.CONFIRMATION_BUTTONS,
              toUser: { acceptLabel: 'Yes, show me', declineLabel: 'No thanks' },
            },
          },
          goalAchieved: false,
          nextAgentId: AgentId.PRESCRIPTION_MANAGEMENT,
        })
      }

      // No chronic medications → end of flow
      return Promise.resolve({
        newChatState: { ...chatState, prescriptionFlowStep: 'goal_achieved' as PrescriptionFlowStep },
        chatbotMessage,
        goalAchieved: true,
        nextAgentId: AgentId.PRESCRIPTION_MANAGEMENT,
      })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: awaiting_initial_amazon_confirmation (Path 2/3)
  // User confirmed Amazon for initial Amoxicillin prescription
  // ─────────────────────────────────────────────────────────────────────────────
  if (currentStep === 'awaiting_initial_amazon_confirmation') {
    if (messageWidget?.type === WidgetType.PHARMACY_CONFIRMATION && messageWidget.toAssistant) {
      // Check if chronic medications exist → prompt for chronic medication (Path 3)
      if (hasChronicMedications) {
        return Promise.resolve({
          newChatState: {
            ...chatState,
            prescriptionFlowStep: 'awaiting_chronic_medication_interest' as PrescriptionFlowStep,
          },
          chatbotMessage: `I also see you're taking ${primaryChronicMed.name}. You could switch that to Amazon Pharmacy as well:`,
          messageMetadata: {
            source: MessageSender.ASSISTANT,
            widget: {
              type: WidgetType.CONFIRMATION_BUTTONS,
              toUser: { acceptLabel: 'Yes, show me', declineLabel: 'No thanks' },
            },
          },
          goalAchieved: false,
          nextAgentId: AgentId.PRESCRIPTION_MANAGEMENT,
        })
      }

      // No chronic medications → end of flow (Path 2 complete)
      return Promise.resolve({
        newChatState: { ...chatState, prescriptionFlowStep: 'goal_achieved' as PrescriptionFlowStep },
        chatbotMessage: 'Your prescription is confirmed. You should receive your Amoxicillin today by 6:00 PM.',
        goalAchieved: true,
        nextAgentId: AgentId.PRESCRIPTION_MANAGEMENT,
      })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: awaiting_chronic_medication_interest
  // User just clicked "Yes, show me" or "No thanks" for Metformin
  // ─────────────────────────────────────────────────────────────────────────────
  if (currentStep === 'awaiting_chronic_medication_interest') {
    if (messageWidget?.type === WidgetType.CONFIRMATION_BUTTONS && messageWidget.toAssistant) {
      const { accepted } = messageWidget.toAssistant

      if (accepted) {
        // User wants to see Amazon pharmacy details for chronic medication
        return Promise.resolve({
          newChatState: {
            ...chatState,
            prescriptionFlowStep: 'awaiting_chronic_medication_decision' as PrescriptionFlowStep,
          },
          chatbotMessage: 'Ok, here are the details for Amazon:',
          messageMetadata: {
            source: MessageSender.ASSISTANT,
            widget: {
              type: WidgetType.PHARMACY_CONFIRMATION,
              toUser: {
                pharmacyId: 'amazon',
                medications: [...prescribedMedications, ...chronicMedications],
                acceptLabel: 'Switch to Amazon',
                declineLabel: "I'm not interested",
              },
            },
          },
          goalAchieved: false,
          nextAgentId: AgentId.PRESCRIPTION_MANAGEMENT,
        })
      } else {
        // User declined to see chronic medication options → end of flow
        return Promise.resolve({
          newChatState: { ...chatState, prescriptionFlowStep: 'goal_achieved' as PrescriptionFlowStep },
          chatbotMessage: `No problem. Your ${primaryChronicMed.name} will stay at your current pharmacy.`,
          goalAchieved: true,
          nextAgentId: AgentId.PRESCRIPTION_MANAGEMENT,
        })
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: awaiting_chronic_medication_decision
  // User just made final decision on Metformin (Switch to Amazon / Not interested)
  // ─────────────────────────────────────────────────────────────────────────────
  if (currentStep === 'awaiting_chronic_medication_decision') {
    if (messageWidget?.type === WidgetType.PHARMACY_CONFIRMATION && messageWidget.toAssistant) {
      const { accepted } = messageWidget.toAssistant
      const chatbotMessage = accepted
        ? `Great! Your ${primaryChronicMed.name} has been switched to Amazon Pharmacy. You should receive it today by 6:00 PM.`
        : `Ok, got it. Your ${primaryChronicMed.name} will stay at your current pharmacy.`

      return Promise.resolve({
        newChatState: { ...chatState, prescriptionFlowStep: 'goal_achieved' as PrescriptionFlowStep },
        chatbotMessage,
        goalAchieved: true,
        nextAgentId: AgentId.PRESCRIPTION_MANAGEMENT,
      })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INITIAL STATE: No step set yet - determine which path to take
  // ─────────────────────────────────────────────────────────────────────────────
  if (userSelectedPharmacyId !== 'amazon') {
    // PATH 1: User pre-selected non-Amazon pharmacy → show PharmacyComparison widget
    return Promise.resolve({
      newChatState: {
        ...chatState,
        prescriptionFlowStep: 'awaiting_pharmacy_selection' as PrescriptionFlowStep,
      },
      chatbotMessage: `Your provider prescribed ${formatMedication(primaryMedication)}. Before I send this to your pharmacy, here's another option:`,
      messageMetadata: {
        source: MessageSender.ASSISTANT,
        widget: {
          type: WidgetType.PHARMACY_COMPARISON,
          toUser: {
            displayText: 'Compare Pharmacies',
            isChronicMedication: false,
            preselectedPharmacyId: userSelectedPharmacyId,
            medications: prescribedMedications,
          },
        },
      },
      goalAchieved: false,
      nextAgentId: AgentId.PRESCRIPTION_MANAGEMENT,
    })
  } else {
    // PATH 2/3: User pre-selected Amazon → show PharmacyConfirmation widget
    return Promise.resolve({
      newChatState: {
        ...chatState,
        prescriptionFlowStep: 'awaiting_initial_amazon_confirmation' as PrescriptionFlowStep,
      },
      chatbotMessage: `Your provider prescribed ${formatMedication(primaryMedication)}. You've chosen Amazon Pharmacy for delivery. Here are the details:`,
      messageMetadata: {
        source: MessageSender.ASSISTANT,
        widget: {
          type: WidgetType.PHARMACY_CONFIRMATION,
          toUser: {
            pharmacyId: 'amazon',
            medications: prescribedMedications,
            acceptLabel: 'Continue with Amazon',
            hideDecline: true,
          },
        },
      },
      goalAchieved: false,
      nextAgentId: AgentId.PRESCRIPTION_MANAGEMENT,
    })
  }
}
