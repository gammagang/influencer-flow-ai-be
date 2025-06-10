import { Router, type Request, type Response } from 'express'
import { SuccessResponse } from '@/libs/success-response'
import { log } from '@/libs/logger'
import { validateRequest } from '@/middlewares/validate-request'
import {
  CreateContractReqSchema,
  UpdateContractReqSchema,
  ListContractsQuerySchema
} from './validate'
import { NotFoundError } from '@/errors/not-found-error'

const router = Router()

// TODO: Replace with actual database interactions and service logic

// Mock database for contracts
const mockContracts: any[] = [
  {
    id: 'contract-uuid-1',
    campaignId: 'campaign-uuid-1',
    creatorId: 'creator-uuid-1',
    campaignCreatorLinkId: 'cc-link-uuid-1',
    contractType: 'fixed_price',
    startDate: new Date('2025-06-01T00:00:00.000Z').toISOString(),
    endDate: new Date('2025-07-01T00:00:00.000Z').toISOString(),
    deliverables: ['1 Instagram Post', '2 Instagram Stories'],
    paymentTerms: {
      totalAmount: 1200,
      currency: 'USD',
      paymentSchedule: [
        {
          milestone: 'Contract Signing',
          amount: 600,
          dueDate: new Date('2025-06-05T00:00:00.000Z').toISOString()
        },
        {
          milestone: 'Content Approval',
          amount: 600,
          dueDate: new Date('2025-06-20T00:00:00.000Z').toISOString()
        }
      ]
    },
    usageRights: {
      platforms: ['Instagram'],
      durationMonths: 6,
      exclusivity: false
    },
    terminationClause: '30-day notice period required for termination.',
    status: 'active',
    additionalClauses: { confidentiality: 'Standard NDA applies.' },
    createdAt: new Date('2025-05-20T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2025-05-20T00:00:00.000Z').toISOString()
  }
]
// Create Contract
router.post('', async (req: Request, res: Response) => {
  const validatedBody = validateRequest(CreateContractReqSchema, req.body, req.path)
  const newContract = {
    id: `contract-uuid-${mockContracts.length + 1}`,
    ...validatedBody,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  mockContracts.push(newContract)
  log.info(`Contract created: ${newContract.id}`)
  SuccessResponse.send({ res, data: newContract, status: 201 })
})

// GET all contracts
router.get('', async (req: Request, res: Response) => {
  const validatedQuery = validateRequest(ListContractsQuerySchema, req.query, req.path)
  const {
    campaignId,
    creatorId,
    contractType,
    status,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = validatedQuery

  let filteredContracts = mockContracts

  if (campaignId) {
    filteredContracts = filteredContracts.filter((c) => c.campaignId === campaignId)
  }
  if (creatorId) {
    filteredContracts = filteredContracts.filter((c) => c.creatorId === creatorId)
  }
  if (contractType) {
    filteredContracts = filteredContracts.filter((c) => c.contractType === contractType)
  }
  if (status) {
    filteredContracts = filteredContracts.filter((c) => c.status === status)
  }

  // TODO: Implement actual sorting logic based on sortBy and sortOrder
  filteredContracts.sort((a, b) => {
    const valA = a[sortBy as string]
    const valB = b[sortBy as string]
    let comparison = 0
    if (valA > valB) {
      comparison = 1
    } else if (valA < valB) {
      comparison = -1
    }
    return sortOrder === 'desc' ? comparison * -1 : comparison
  })

  const startIndex = (Number(page) - 1) * Number(limit)
  const endIndex = startIndex + Number(limit)
  const paginatedContracts = filteredContracts.slice(startIndex, endIndex)

  log.info(`Contracts listed with filters: ${JSON.stringify(req.query)}`)
  SuccessResponse.send({
    res,
    data: {
      items: paginatedContracts,
      pagination: {
        totalItems: filteredContracts.length,
        currentPage: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(filteredContracts.length / Number(limit))
      }
    }
  })
})

// Get Contract info with PDF link
router.get('/:contractId', async (req: Request, res: Response) => {
  const { contractId } = req.params
  const contract = mockContracts.find((c) => c.id === contractId)

  if (!contract) {
    throw new NotFoundError(
      'Contract not found',
      `Contract with ID ${contractId} not found`,
      req.path
    )
  }

  log.info(`Contract retrieved: ${contractId}`)
  SuccessResponse.send({ res, data: contract })
})

router.put('/:contractId', async (req: Request, res: Response) => {
  const { contractId } = req.params
  const validatedBody = validateRequest(UpdateContractReqSchema, req.body, req.path)
  const index = mockContracts.findIndex((c) => c.id === contractId)

  if (index === -1) {
    throw new NotFoundError(
      'Contract not found for update',
      `Contract with ID ${contractId} not found for update`,
      req.path
    )
  }

  mockContracts[index] = {
    ...mockContracts[index],
    ...validatedBody,
    updatedAt: new Date().toISOString()
  }

  log.info(`Contract updated: ${contractId}`)
  SuccessResponse.send({ res, data: mockContracts[index] })
})

router.delete('/:contractId', async (req: Request, res: Response) => {
  const { contractId } = req.params
  const index = mockContracts.findIndex((c) => c.id === contractId)

  if (index === -1) {
    throw new NotFoundError(
      'Contract not found for deletion',
      `Contract with ID ${contractId} not found for deletion`,
      req.path
    )
  }

  const deletedContract = mockContracts.splice(index, 1)[0]
  log.info(`Contract deleted: ${contractId}`)
  SuccessResponse.send({ res, data: deletedContract })
})

export const contractsRouter = router
