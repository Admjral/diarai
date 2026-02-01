import { Router } from 'express';
import { CampaignsController } from '../controllers/campaigns.controller';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import { createCampaignSchema, updateCampaignSchema, idParamSchema } from '../validations/schemas';

const router = Router();

router.get('/', CampaignsController.getCampaigns);
router.get('/:id', validateParams(idParamSchema), CampaignsController.getCampaignById);
router.post('/', validateBody(createCampaignSchema), CampaignsController.createCampaign);
router.post('/upload-image', CampaignsController.uploadImage);
router.put('/:id', validateParams(idParamSchema), validateBody(updateCampaignSchema), CampaignsController.updateCampaign);
router.delete('/:id', validateParams(idParamSchema), CampaignsController.deleteCampaign);

export default router;

