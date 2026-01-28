import { Agent } from 'types'
import { auth } from './auth'
import { discharge } from './discharge'
import { prescriptionManagement } from './prescription_management'
import { wrapUp } from './wrapUp'

import { labs } from '@skills/labResults/agents/labs'

export const agents: Agent[] = [auth, discharge, wrapUp, labs, prescriptionManagement]
