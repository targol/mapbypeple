import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import * as dotenv from 'dotenv';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import {
  createEventRecord,
  createLayerRecord,
  createMediaRecord,
  createPersonRecord,
  createPlaceRecord,
  createPublicContribution,
  createRouteRecord,
  createStoryRecord,
  deleteEventRecord,
  deleteLayerRecord,
  deleteMediaRecord,
  deletePersonRecord,
  deletePlaceRecord,
  deleteRouteRecord,
  deleteStoryRecord,
  getAdminBundle,
  getOrCreateUser,
  getPublicMapBundle,
  updateContributionStatus,
  updateEventRecord,
  updateLayerRecord,
  updateMediaRecord,
  updatePersonRecord,
  updatePlaceRecord,
  updateRouteRecord,
  updateStoryRecord,
} from './src/db/repository.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // WordPress / Elementor iframe embedding support across external domains
  app.use((_req, res, next) => {
    res.setHeader('Content-Security-Policy', 'frame-ancestors *');
    res.removeHeader('X-Frame-Options');
    next();
  });

  // --- PUBLIC ROUTES ---

  app.get('/api/public/map-bundle', async (_req, res) => {
    try {
      const bundle = await getPublicMapBundle();
      res.json(bundle);
    } catch (error: any) {
      console.error('Error in GET /api/public/map-bundle:', error);
      res.status(500).json({ error: error.message || 'Failed to load map data' });
    }
  });

  app.post('/api/public/contributions', async (req, res) => {
    try {
      const {
        submissionType,
        title,
        description,
        latitude,
        longitude,
        mediaUrl,
        contributorName,
        contactInfo,
        consentToPublish,
      } = req.body;

      if (!submissionType || !title || !description || !contributorName || !contactInfo) {
        return res.status(400).json({ error: 'لطفاً تمام فیلدهای الزامی را تکمیل نمایید.' });
      }
      if (!consentToPublish) {
        return res.status(400).json({ error: 'تایید رضایت‌نامه انتشار برای ارسال مشارکت الزامی است.' });
      }

      const created = await createPublicContribution({
        submissionType,
        title,
        description,
        latitude: latitude !== undefined && latitude !== '' ? Number(latitude) : null,
        longitude: longitude !== undefined && longitude !== '' ? Number(longitude) : null,
        mediaUrl: mediaUrl || null,
        contributorName,
        contactInfo,
        consentToPublish: Boolean(consentToPublish),
      });

      res.status(201).json(created);
    } catch (error: any) {
      console.error('Error in POST /api/public/contributions:', error);
      res.status(500).json({ error: error.message || 'Failed to submit contribution' });
    }
  });

  // --- AUTHENTICATED ADMINISTRATOR ROUTES ---

  app.get('/api/admin/bundle', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userRecord = req.user
        ? await getOrCreateUser(req.user.uid, req.user.email || 'admin@barzok.ir', req.user.name)
        : null;
      const bundle = await getAdminBundle();
      res.json({ ...bundle, currentUser: userRecord });
    } catch (error: any) {
      console.error('Error in GET /api/admin/bundle:', error);
      res.status(500).json({ error: error.message || 'Failed to load admin data' });
    }
  });

  // Layer Management
  app.post('/api/admin/layers', requireAuth, async (req: AuthRequest, res) => {
    try {
      const {
        slug,
        nameFa,
        nameEn,
        descriptionFa,
        descriptionEn,
        icon,
        color,
        isVisible,
        isActive,
        displayOrder,
        isDemo,
      } = req.body;

      if (!nameFa) {
        return res.status(400).json({ error: 'نام فارسی لایه الزامی است.' });
      }

      const cleanSlug =
        slug ||
        `layer-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const created = await createLayerRecord({
        slug: cleanSlug,
        nameFa,
        nameEn: nameEn || null,
        descriptionFa: descriptionFa || null,
        descriptionEn: descriptionEn || null,
        icon: icon || 'landmark',
        color: color || '#254B36',
        isVisible: isVisible !== undefined ? Boolean(isVisible) : true,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        displayOrder: Number(displayOrder) || 0,
        isDemo: Boolean(isDemo),
      });

      res.status(201).json(created);
    } catch (error: any) {
      console.error('Error in POST /api/admin/layers:', error);
      res.status(500).json({ error: error.message || 'Failed to create layer' });
    }
  });

  app.put('/api/admin/layers/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await updateLayerRecord(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('Error in PUT /api/admin/layers/:id:', error);
      res.status(500).json({ error: error.message || 'Failed to update layer' });
    }
  });

  app.delete('/api/admin/layers/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const result = await deleteLayerRecord(req.params.id);
      res.json(result);
    } catch (error: any) {
      console.error('Error in DELETE /api/admin/layers/:id:', error);
      res.status(500).json({ error: error.message || 'Failed to delete layer' });
    }
  });

  // Helper to convert Persian/Arabic digits to English numbers for coordinates
  const normalizeCoord = (val: unknown, fallback: number): number => {
    if (typeof val === 'number' && !Number.isNaN(val)) return val;
    if (typeof val === 'string' && val.trim() !== '') {
      const normalized = val
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
        .replace(/[/،,]/g, '.')
        .trim();
      const parsed = Number(normalized);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return fallback;
  };

  // Location / Place Management
  app.post('/api/admin/places', requireAuth, async (req: AuthRequest, res) => {
    try {
      const {
        slug,
        layerId,
        additionalLayerIds,
        nameFa,
        nameEn,
        category,
        shortIntroFa,
        shortIntroEn,
        fullDescriptionFa,
        fullDescriptionEn,
        latitude,
        longitude,
        historicalInfoFa,
        historicalInfoEn,
        currentStatusFa,
        currentStatusEn,
        historicalPhotos,
        recentPhotos,
        audioRecordings,
        videoLinks,
        sourceReference,
        documentationDate,
        contributorName,
        contributorApproved,
        publicationStatus,
        verificationStatus,
        isDemo,
        personIds,
        storyIds,
      } = req.body;

      if (!nameFa || !String(nameFa).trim()) {
        return res.status(400).json({ error: 'وارد کردن «نام فارسی مکان» الزامی است.' });
      }

      const parsedLat = normalizeCoord(latitude, 33.7925);
      const parsedLng = normalizeCoord(longitude, 51.2292);

      const cleanSlug =
        (slug && String(slug).trim()) ||
        `place-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const created = await createPlaceRecord(
        {
          slug: cleanSlug,
          layerId: layerId || null,
          additionalLayerIds:
            typeof additionalLayerIds === 'string'
              ? additionalLayerIds
              : JSON.stringify(additionalLayerIds || []),
          nameFa: String(nameFa).trim(),
          nameEn: nameEn ? String(nameEn).trim() : null,
          category: category || 'میراث و معماری',
          shortIntroFa: (shortIntroFa && String(shortIntroFa).trim()) || String(nameFa).trim(),
          shortIntroEn: shortIntroEn || null,
          fullDescriptionFa:
            (fullDescriptionFa && String(fullDescriptionFa).trim()) ||
            (shortIntroFa && String(shortIntroFa).trim()) ||
            String(nameFa).trim(),
          fullDescriptionEn: fullDescriptionEn || null,
          latitude: parsedLat,
          longitude: parsedLng,
          historicalInfoFa: historicalInfoFa || null,
          historicalInfoEn: historicalInfoEn || null,
          currentStatusFa: currentStatusFa || null,
          currentStatusEn: currentStatusEn || null,
          historicalPhotos:
            typeof historicalPhotos === 'string'
              ? historicalPhotos
              : JSON.stringify(historicalPhotos || []),
          recentPhotos:
            typeof recentPhotos === 'string'
              ? recentPhotos
              : JSON.stringify(recentPhotos || []),
          audioRecordings:
            typeof audioRecordings === 'string'
              ? audioRecordings
              : JSON.stringify(audioRecordings || []),
          videoLinks:
            typeof videoLinks === 'string'
              ? videoLinks
              : JSON.stringify(videoLinks || []),
          sourceReference: sourceReference || null,
          documentationDate: documentationDate || null,
          contributorName: contributorName || null,
          contributorApproved: Boolean(contributorApproved),
          publicationStatus: publicationStatus || 'published',
          verificationStatus: verificationStatus || 'verified',
          isDemo: Boolean(isDemo),
        },
        Array.isArray(personIds) ? personIds : [],
        Array.isArray(storyIds) ? storyIds : []
      );

      res.status(201).json(created);
    } catch (error: any) {
      console.error('Error in POST /api/admin/places:', error);
      res.status(500).json({ error: error.message || 'خطا در ثبت مکان جدید' });
    }
  });

  app.put('/api/admin/places/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { personIds, storyIds, ...placeFields } = req.body;
      const payload: Record<string, any> = { ...placeFields };

      if (payload.latitude !== undefined) {
        payload.latitude = normalizeCoord(payload.latitude, 33.7925);
      }
      if (payload.longitude !== undefined) {
        payload.longitude = normalizeCoord(payload.longitude, 51.2292);
      }
      if (payload.additionalLayerIds && typeof payload.additionalLayerIds !== 'string') {
        payload.additionalLayerIds = JSON.stringify(payload.additionalLayerIds);
      }
      if (payload.historicalPhotos && typeof payload.historicalPhotos !== 'string') {
        payload.historicalPhotos = JSON.stringify(payload.historicalPhotos);
      }
      if (payload.recentPhotos && typeof payload.recentPhotos !== 'string') {
        payload.recentPhotos = JSON.stringify(payload.recentPhotos);
      }
      if (payload.audioRecordings && typeof payload.audioRecordings !== 'string') {
        payload.audioRecordings = JSON.stringify(payload.audioRecordings);
      }
      if (payload.videoLinks && typeof payload.videoLinks !== 'string') {
        payload.videoLinks = JSON.stringify(payload.videoLinks);
      }

      const updated = await updatePlaceRecord(
        req.params.id,
        payload,
        Array.isArray(personIds) ? personIds : undefined,
        Array.isArray(storyIds) ? storyIds : undefined
      );
      res.json(updated);
    } catch (error: any) {
      console.error('Error in PUT /api/admin/places/:id:', error);
      res.status(500).json({ error: error.message || 'Failed to update location' });
    }
  });

  app.delete('/api/admin/places/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const result = await deletePlaceRecord(req.params.id);
      res.json(result);
    } catch (error: any) {
      console.error('Error in DELETE /api/admin/places/:id:', error);
      res.status(500).json({ error: error.message || 'Failed to delete location' });
    }
  });

  // People Management
  app.post('/api/admin/people', requireAuth, async (req: AuthRequest, res) => {
    try {
      const {
        nameFa,
        nameEn,
        occupationFa,
        occupationEn,
        bioFa,
        bioEn,
        era,
        avatarUrl,
        sourceReference,
        contributorName,
        publicationStatus,
        verificationStatus,
        isDemo,
      } = req.body;

      if (!nameFa || !occupationFa || !bioFa) {
        return res.status(400).json({ error: 'نام، پیشه و زندگی‌نامه فارسی الزامی است.' });
      }

      const created = await createPersonRecord({
        nameFa,
        nameEn: nameEn || null,
        occupationFa,
        occupationEn: occupationEn || null,
        bioFa,
        bioEn: bioEn || null,
        era: era || null,
        avatarUrl: avatarUrl || null,
        sourceReference: sourceReference || null,
        contributorName: contributorName || null,
        publicationStatus: publicationStatus || 'published',
        verificationStatus: verificationStatus || 'verified',
        isDemo: Boolean(isDemo),
      });
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Error in POST /api/admin/people:', error);
      res.status(500).json({ error: error.message || 'Failed to create person' });
    }
  });

  app.put('/api/admin/people/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await updatePersonRecord(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('Error in PUT /api/admin/people/:id:', error);
      res.status(500).json({ error: error.message || 'Failed to update person' });
    }
  });

  app.delete('/api/admin/people/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const result = await deletePersonRecord(req.params.id);
      res.json(result);
    } catch (error: any) {
      console.error('Error in DELETE /api/admin/people/:id:', error);
      res.status(500).json({ error: error.message || 'Failed to delete person' });
    }
  });

  // Stories Management
  app.post('/api/admin/stories', requireAuth, async (req: AuthRequest, res) => {
    try {
      const {
        slug,
        titleFa,
        titleEn,
        summaryFa,
        summaryEn,
        contentFa,
        contentEn,
        narratorName,
        audioUrl,
        imageUrl,
        recordedDate,
        sourceReference,
        contributorName,
        publicationStatus,
        verificationStatus,
        isDemo,
        placeIds,
      } = req.body;

      if (!titleFa || !contentFa) {
        return res.status(400).json({ error: 'عنوان و متن داستان الزامی است.' });
      }

      const cleanSlug =
        slug ||
        `story-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const created = await createStoryRecord(
        {
          slug: cleanSlug,
          titleFa,
          titleEn: titleEn || null,
          summaryFa: summaryFa || titleFa,
          summaryEn: summaryEn || null,
          contentFa,
          contentEn: contentEn || null,
          narratorName: narratorName || null,
          audioUrl: audioUrl || null,
          imageUrl: imageUrl || null,
          recordedDate: recordedDate || null,
          sourceReference: sourceReference || null,
          contributorName: contributorName || null,
          publicationStatus: publicationStatus || 'published',
          verificationStatus: verificationStatus || 'verified',
          isDemo: Boolean(isDemo),
        },
        Array.isArray(placeIds) ? placeIds : []
      );
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Error in POST /api/admin/stories:', error);
      res.status(500).json({ error: error.message || 'Failed to create story' });
    }
  });

  app.put('/api/admin/stories/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { placeIds, ...storyFields } = req.body;
      const updated = await updateStoryRecord(
        req.params.id,
        storyFields,
        Array.isArray(placeIds) ? placeIds : undefined
      );
      res.json(updated);
    } catch (error: any) {
      console.error('Error in PUT /api/admin/stories/:id:', error);
      res.status(500).json({ error: error.message || 'Failed to update story' });
    }
  });

  app.delete('/api/admin/stories/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const result = await deleteStoryRecord(req.params.id);
      res.json(result);
    } catch (error: any) {
      console.error('Error in DELETE /api/admin/stories/:id:', error);
      res.status(500).json({ error: error.message || 'Failed to delete story' });
    }
  });

  // Events Management
  app.post('/api/admin/events', requireAuth, async (req: AuthRequest, res) => {
    try {
      const {
        placeId,
        titleFa,
        titleEn,
        descriptionFa,
        descriptionEn,
        seasonOrDateFa,
        seasonOrDateEn,
        eventType,
        sourceReference,
        publicationStatus,
        verificationStatus,
      } = req.body;

      if (!titleFa || !descriptionFa || !seasonOrDateFa) {
        return res.status(400).json({ error: 'عنوان، زمان برگزاری و توضیحات رویداد الزامی است.' });
      }

      const created = await createEventRecord({
        placeId: placeId || null,
        titleFa,
        titleEn: titleEn || null,
        descriptionFa,
        descriptionEn: descriptionEn || null,
        seasonOrDateFa,
        seasonOrDateEn: seasonOrDateEn || null,
        eventType: eventType || 'ritual',
        sourceReference: sourceReference || null,
        publicationStatus: publicationStatus || 'published',
        verificationStatus: verificationStatus || 'verified',
        isDemo: false,
      });
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Error in POST /api/admin/events:', error);
      res.status(500).json({ error: error.message || 'Failed to create event' });
    }
  });

  app.put('/api/admin/events/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await updateEventRecord(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('Error in PUT /api/admin/events/:id:', error);
      res.status(500).json({ error: error.message || 'Failed to update event' });
    }
  });

  app.delete('/api/admin/events/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const result = await deleteEventRecord(req.params.id);
      res.json(result);
    } catch (error: any) {
      console.error('Error in DELETE /api/admin/events/:id:', error);
      res.status(500).json({ error: error.message || 'Failed to delete event' });
    }
  });

  // Walking Routes Management
  app.post('/api/admin/routes', requireAuth, async (req: AuthRequest, res) => {
    try {
      const {
        slug,
        titleFa,
        titleEn,
        descriptionFa,
        descriptionEn,
        durationMinutes,
        distanceKm,
        difficulty,
        color,
        stops,
      } = req.body;

      if (!titleFa || !descriptionFa) {
        return res.status(400).json({ error: 'عنوان و توضیحات مسیر پیاده‌روی الزامی است.' });
      }

      const cleanSlug =
        slug ||
        `route-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const created = await createRouteRecord(
        {
          slug: cleanSlug,
          titleFa,
          titleEn: titleEn || null,
          descriptionFa,
          descriptionEn: descriptionEn || null,
          durationMinutes: Number(durationMinutes) || 60,
          distanceKm: Number(distanceKm) || 1.5,
          difficulty: difficulty || 'easy',
          color: color || '#D6A83F',
          publicationStatus: 'published',
          verificationStatus: 'verified',
          isDemo: false,
        },
        Array.isArray(stops) ? stops : []
      );
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Error in POST /api/admin/routes:', error);
      res.status(500).json({ error: error.message || 'Failed to create route' });
    }
  });

  app.put('/api/admin/routes/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { stops, ...routeFields } = req.body;
      const payload: Record<string, any> = { ...routeFields };
      if (payload.durationMinutes !== undefined) {
        payload.durationMinutes = Number(payload.durationMinutes) || 60;
      }
      if (payload.distanceKm !== undefined) {
        payload.distanceKm = Number(payload.distanceKm) || 1.5;
      }
      const updated = await updateRouteRecord(
        req.params.id,
        payload,
        Array.isArray(stops) ? stops : undefined
      );
      res.json(updated);
    } catch (error: any) {
      console.error('Error in PUT /api/admin/routes/:id:', error);
      res.status(500).json({ error: error.message || 'Failed to update route' });
    }
  });

  app.delete('/api/admin/routes/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const result = await deleteRouteRecord(req.params.id);
      res.json(result);
    } catch (error: any) {
      console.error('Error in DELETE /api/admin/routes/:id:', error);
      res.status(500).json({ error: error.message || 'Failed to delete route' });
    }
  });

  // Media Management
  app.post('/api/admin/media', requireAuth, async (req: AuthRequest, res) => {
    try {
      const {
        placeId,
        storyId,
        mediaType,
        fileUrl,
        titleFa,
        titleEn,
        captionFa,
        captionEn,
        captureDate,
        photographerOrCreator,
        sourceReference,
      } = req.body;

      if (!fileUrl || !titleFa) {
        return res.status(400).json({ error: 'عنوان و آدرس رسانه الزامی است.' });
      }

      const created = await createMediaRecord({
        placeId: placeId || null,
        storyId: storyId || null,
        mediaType: mediaType || 'recent_photo',
        fileUrl,
        titleFa,
        titleEn: titleEn || null,
        captionFa: captionFa || null,
        captionEn: captionEn || null,
        captureDate: captureDate || null,
        photographerOrCreator: photographerOrCreator || null,
        sourceReference: sourceReference || null,
        publicationStatus: 'published',
        verificationStatus: 'verified',
        isDemo: false,
      });
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Error in POST /api/admin/media:', error);
      res.status(500).json({ error: error.message || 'Failed to create media' });
    }
  });

  app.put('/api/admin/media/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await updateMediaRecord(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('Error in PUT /api/admin/media/:id:', error);
      res.status(500).json({ error: error.message || 'Failed to update media' });
    }
  });

  app.delete('/api/admin/media/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const result = await deleteMediaRecord(req.params.id);
      res.json(result);
    } catch (error: any) {
      console.error('Error in DELETE /api/admin/media/:id:', error);
      res.status(500).json({ error: error.message || 'Failed to delete media' });
    }
  });

  // Moderation Queue Management
  app.put('/api/admin/contributions/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { moderationStatus, adminNotes } = req.body;
      const updated = await updateContributionStatus(
        req.params.id,
        moderationStatus,
        adminNotes
      );
      res.json(updated);
    } catch (error: any) {
      console.error('Error in PUT /api/admin/contributions/:id:', error);
      res.status(500).json({ error: error.message || 'Failed to update contribution status' });
    }
  });

  // Vite middleware for development vs static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Barzok People Map server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
