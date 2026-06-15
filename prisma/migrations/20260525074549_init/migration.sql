-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `role` ENUM('MSME', 'LRDB') NOT NULL DEFAULT 'MSME',
    `language` ENUM('en', 'mr', 'hi') NOT NULL DEFAULT 'en',
    `notifyViaApp` BOOLEAN NOT NULL DEFAULT true,
    `notifyViaEmail` BOOLEAN NOT NULL DEFAULT true,
    `notifyViaSms` BOOLEAN NOT NULL DEFAULT false,
    `notifyViaWhatsapp` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastLoginAt` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shop_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `shopName` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `district` VARCHAR(191) NOT NULL,
    `taluka` VARCHAR(191) NOT NULL,
    `pincode` VARCHAR(191) NOT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `phoneNumber` VARCHAR(191) NULL,
    `gstNumber` VARCHAR(191) NULL,
    `establishedYear` INTEGER NULL,
    `regionCode` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shop_profiles_userId_key`(`userId`),
    INDEX `shop_profiles_regionCode_idx`(`regionCode`),
    INDEX `shop_profiles_district_idx`(`district`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `emergency_contacts` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `relationship` VARCHAR(191) NOT NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,

    INDEX `emergency_contacts_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_items` (
    `id` VARCHAR(191) NOT NULL,
    `shopProfileId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `estimatedValueInr` DOUBLE NOT NULL,
    `storageLocation` VARCHAR(191) NULL,
    `expiryDate` DATETIME(3) NULL,
    `vulnerabilityScore` INTEGER NOT NULL DEFAULT 0,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `stock_items_shopProfileId_idx`(`shopProfileId`),
    INDEX `stock_items_expiryDate_idx`(`expiryDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_sensitivities` (
    `id` VARCHAR(191) NOT NULL,
    `stockItemId` VARCHAR(191) NOT NULL,
    `type` ENUM('WATER', 'HEAT', 'FRAGILE', 'PERISHABLE', 'FLAMMABLE', 'THEFT', 'HUMIDITY') NOT NULL,

    UNIQUE INDEX `stock_sensitivities_stockItemId_type_key`(`stockItemId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alerts` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    `category` ENUM('FLOOD', 'WIND', 'POWER_OUTAGE', 'TRANSPORT', 'LANDSLIDE', 'HEATWAVE', 'OTHER') NOT NULL,
    `summary` TEXT NOT NULL,
    `affectedRegions` VARCHAR(191) NOT NULL,
    `weatherEventRef` VARCHAR(191) NULL,
    `issuedByUserId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `alerts_severity_idx`(`severity`),
    INDEX `alerts_isActive_idx`(`isActive`),
    INDEX `alerts_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alert_recipients` (
    `id` VARCHAR(191) NOT NULL,
    `alertId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `readAt` DATETIME(3) NULL,

    INDEX `alert_recipients_userId_isRead_idx`(`userId`, `isRead`),
    UNIQUE INDEX `alert_recipients_alertId_userId_key`(`alertId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alert_actions` (
    `id` VARCHAR(191) NOT NULL,
    `alertId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `actionType` VARCHAR(191) NOT NULL,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alert_action_results` (
    `id` VARCHAR(191) NOT NULL,
    `alertActionId` VARCHAR(191) NOT NULL,
    `alertRecipientId` VARCHAR(191) NOT NULL,
    `isCompleted` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,

    UNIQUE INDEX `alert_action_results_alertActionId_alertRecipientId_key`(`alertActionId`, `alertRecipientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bcp_plans` (
    `id` VARCHAR(191) NOT NULL,
    `shopProfileId` VARCHAR(191) NOT NULL,
    `completionPercent` INTEGER NOT NULL DEFAULT 0,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastUpdatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bcp_plans_shopProfileId_key`(`shopProfileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bcp_steps` (
    `id` VARCHAR(191) NOT NULL,
    `bcpPlanId` VARCHAR(191) NOT NULL,
    `phase` ENUM('BEFORE', 'DURING', 'AFTER') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `isCompleted` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,
    `isOptional` BOOLEAN NOT NULL DEFAULT false,

    INDEX `bcp_steps_bcpPlanId_phase_idx`(`bcpPlanId`, `phase`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `risk_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `shopProfileId` VARCHAR(191) NOT NULL,
    `overallScore` INTEGER NOT NULL,
    `floodScore` INTEGER NOT NULL DEFAULT 0,
    `powerScore` INTEGER NOT NULL DEFAULT 0,
    `stockScore` INTEGER NOT NULL DEFAULT 0,
    `locationScore` INTEGER NOT NULL DEFAULT 0,
    `accessScore` INTEGER NOT NULL DEFAULT 0,
    `riskLevel` ENUM('SAFE', 'MODERATE', 'HIGH', 'CRITICAL', 'OFFLINE') NOT NULL DEFAULT 'MODERATE',
    `lastComputedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `risk_profiles_shopProfileId_key`(`shopProfileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `risk_suggestions` (
    `id` VARCHAR(191) NOT NULL,
    `riskProfileId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `impactScore` INTEGER NOT NULL,
    `isActioned` BOOLEAN NOT NULL DEFAULT false,
    `actionedAt` DATETIME(3) NULL,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,

    INDEX `risk_suggestions_riskProfileId_idx`(`riskProfileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `forecast_scenarios` (
    `id` VARCHAR(191) NOT NULL,
    `shopProfileId` VARCHAR(191) NOT NULL,
    `disasterType` VARCHAR(191) NOT NULL,
    `probability` VARCHAR(191) NOT NULL,
    `estimatedLossInr` DOUBLE NOT NULL,
    `affectedItemCount` INTEGER NOT NULL,
    `estimatedDowntimeDays` INTEGER NOT NULL,
    `recoveryTimelineDays` INTEGER NOT NULL,
    `aiNarrative` TEXT NOT NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `forecast_scenarios_shopProfileId_idx`(`shopProfileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `forecast_affected_items` (
    `id` VARCHAR(191) NOT NULL,
    `forecastScenarioId` VARCHAR(191) NOT NULL,
    `stockItemName` VARCHAR(191) NOT NULL,
    `estimatedDamageInr` DOUBLE NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trend_data_points` (
    `id` VARCHAR(191) NOT NULL,
    `regionCode` VARCHAR(191) NOT NULL,
    `trendType` VARCHAR(191) NOT NULL,
    `value` DOUBLE NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL,
    `source` VARCHAR(191) NULL,

    INDEX `trend_data_points_regionCode_trendType_idx`(`regionCode`, `trendType`),
    INDEX `trend_data_points_recordedAt_idx`(`recordedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `location_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `shopProfileId` VARCHAR(191) NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `manuallySet` BOOLEAN NOT NULL DEFAULT false,
    `nominatimPlaceId` VARCHAR(191) NULL,
    `village` VARCHAR(191) NULL,
    `suburb` VARCHAR(191) NULL,
    `taluka` VARCHAR(191) NULL,
    `district` VARCHAR(191) NULL,
    `pincode` VARCHAR(191) NULL,
    `elevationMetres` DOUBLE NULL,
    `terrainSlope` DOUBLE NULL,
    `slopeAspect` VARCHAR(191) NULL,
    `terrainType` ENUM('HILLY', 'FLAT', 'VALLEY', 'SLOPE') NULL,
    `nearestWaterBodyName` VARCHAR(191) NULL,
    `nearestWaterBodyType` ENUM('RIVER', 'STREAM', 'LAKE', 'RESERVOIR', 'DAM', 'NALLA', 'NONE') NULL,
    `nearestWaterBodyDistanceMetres` DOUBLE NULL,
    `nearestReservoirName` VARCHAR(191) NULL,
    `nearestReservoirDistanceKm` DOUBLE NULL,
    `nearestDamName` VARCHAR(191) NULL,
    `nearestDamDistanceKm` DOUBLE NULL,
    `nearestHospitalName` VARCHAR(191) NULL,
    `nearestHospitalDistanceKm` DOUBLE NULL,
    `nearestPoliceStationName` VARCHAR(191) NULL,
    `nearestPoliceStationDistanceKm` DOUBLE NULL,
    `nearestFireStationName` VARCHAR(191) NULL,
    `nearestFireStationDistanceKm` DOUBLE NULL,
    `nearestReliefCentreName` VARCHAR(191) NULL,
    `nearestReliefCentreDistanceKm` DOUBLE NULL,
    `nearestLRDBCentreName` VARCHAR(191) NULL,
    `nearestLRDBCentreDistanceKm` DOUBLE NULL,
    `nearestRoadType` ENUM('STATE_HIGHWAY', 'DISTRICT_ROAD', 'VILLAGE_ROAD', 'KACHCHA', 'NONE') NULL,
    `nearestPavedRoadDistanceMetres` DOUBLE NULL,
    `nearestSubstationName` VARCHAR(191) NULL,
    `nearestSubstationDistanceKm` DOUBLE NULL,
    `connectivityType` ENUM('FOUR_G', 'THREE_G', 'TWO_G', 'NONE') NULL,
    `powerSupplyType` ENUM('GRID', 'SOLAR', 'GENERATOR', 'MIXED') NULL,
    `shopFloorLevel` ENUM('GROUND', 'FIRST', 'BASEMENT') NULL,
    `buildingType` ENUM('PUCCA', 'SEMI_PUCCA', 'KUTCHA') NULL,
    `roofType` ENUM('RCC_SLAB', 'TIN_SHEET', 'ASBESTOS', 'TILED', 'THATCHED') NULL,
    `hasBasement` BOOLEAN NULL,
    `shopAreaSqFt` INTEGER NULL,
    `storageFloorLevel` ENUM('GROUND_LEVEL', 'ELEVATED_SHELF', 'FIRST_FLOOR') NULL,
    `imdGridRef` VARCHAR(191) NULL,
    `meteosourceLocationId` VARCHAR(191) NULL,
    `batchStatus` ENUM('PENDING', 'RUNNING', 'COMPLETE', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `lastBatchRunAt` DATETIME(3) NULL,
    `batchErrorMessage` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `location_profiles_shopProfileId_key`(`shopProfileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lrdb_officers` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `district` VARCHAR(191) NOT NULL,
    `taluka` VARCHAR(191) NULL,
    `designation` VARCHAR(191) NOT NULL,
    `regionCode` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `lrdb_officers_userId_key`(`userId`),
    INDEX `lrdb_officers_regionCode_idx`(`regionCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `queries` (
    `id` VARCHAR(191) NOT NULL,
    `shopProfileId` VARCHAR(191) NOT NULL,
    `submittedByUserId` VARCHAR(191) NOT NULL,
    `assignedToUserId` VARCHAR(191) NULL,
    `queryType` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('PENDING', 'UNDER_REVIEW', 'ASSIGNED', 'RESOLVED', 'ESCALATED') NOT NULL DEFAULT 'PENDING',
    `resolvedAt` DATETIME(3) NULL,
    `resolutionNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `queries_status_priority_idx`(`status`, `priority`),
    INDEX `queries_submittedByUserId_idx`(`submittedByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `query_status_history` (
    `id` VARCHAR(191) NOT NULL,
    `queryId` VARCHAR(191) NOT NULL,
    `fromStatus` ENUM('PENDING', 'UNDER_REVIEW', 'ASSIGNED', 'RESOLVED', 'ESCALATED') NULL,
    `toStatus` ENUM('PENDING', 'UNDER_REVIEW', 'ASSIGNED', 'RESOLVED', 'ESCALATED') NOT NULL,
    `changedBy` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `query_status_history_queryId_idx`(`queryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `disaster_reports` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `disasterType` VARCHAR(191) NOT NULL,
    `affectedZone` VARCHAR(191) NOT NULL,
    `affectedRegionCode` VARCHAR(191) NOT NULL,
    `reportDate` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `createdByUserId` VARCHAR(191) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `summary` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `disaster_reports_affectedRegionCode_idx`(`affectedRegionCode`),
    INDEX `disaster_reports_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `report_metrics` (
    `id` VARCHAR(191) NOT NULL,
    `disasterReportId` VARCHAR(191) NOT NULL,
    `metricKey` VARCHAR(191) NOT NULL,
    `metricValue` DOUBLE NOT NULL,
    `metricLabel` VARCHAR(191) NOT NULL,
    `sectorBreakdown` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_groups` (
    `id` VARCHAR(191) NOT NULL,
    `streamChannelId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `regionCode` VARCHAR(191) NOT NULL,
    `groupType` ENUM('LOCAL_MSME', 'LRDB_COORDINATION', 'DIRECT_MESSAGE', 'SOS_EMERGENCY') NOT NULL,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `chat_groups_streamChannelId_key`(`streamChannelId`),
    INDEX `chat_groups_regionCode_idx`(`regionCode`),
    INDEX `chat_groups_groupType_idx`(`groupType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_group_members` (
    `id` VARCHAR(191) NOT NULL,
    `chatGroupId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isAdmin` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `chat_group_members_chatGroupId_userId_key`(`chatGroupId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_labels` (
    `id` VARCHAR(191) NOT NULL,
    `chatGroupId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `chat_labels_chatGroupId_label_key`(`chatGroupId`, `label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_logs` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `channel` ENUM('APP', 'EMAIL', 'SMS', 'WHATSAPP') NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `status` ENUM('QUEUED', 'SENT', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `sentAt` DATETIME(3) NULL,
    `failReason` VARCHAR(191) NULL,
    `referenceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notification_logs_userId_status_idx`(`userId`, `status`),
    INDEX `notification_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `shop_profiles` ADD CONSTRAINT `shop_profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emergency_contacts` ADD CONSTRAINT `emergency_contacts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_items` ADD CONSTRAINT `stock_items_shopProfileId_fkey` FOREIGN KEY (`shopProfileId`) REFERENCES `shop_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_sensitivities` ADD CONSTRAINT `stock_sensitivities_stockItemId_fkey` FOREIGN KEY (`stockItemId`) REFERENCES `stock_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_recipients` ADD CONSTRAINT `alert_recipients_alertId_fkey` FOREIGN KEY (`alertId`) REFERENCES `alerts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_recipients` ADD CONSTRAINT `alert_recipients_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_actions` ADD CONSTRAINT `alert_actions_alertId_fkey` FOREIGN KEY (`alertId`) REFERENCES `alerts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_action_results` ADD CONSTRAINT `alert_action_results_alertActionId_fkey` FOREIGN KEY (`alertActionId`) REFERENCES `alert_actions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_action_results` ADD CONSTRAINT `alert_action_results_alertRecipientId_fkey` FOREIGN KEY (`alertRecipientId`) REFERENCES `alert_recipients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bcp_plans` ADD CONSTRAINT `bcp_plans_shopProfileId_fkey` FOREIGN KEY (`shopProfileId`) REFERENCES `shop_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bcp_steps` ADD CONSTRAINT `bcp_steps_bcpPlanId_fkey` FOREIGN KEY (`bcpPlanId`) REFERENCES `bcp_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `risk_profiles` ADD CONSTRAINT `risk_profiles_shopProfileId_fkey` FOREIGN KEY (`shopProfileId`) REFERENCES `shop_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `risk_suggestions` ADD CONSTRAINT `risk_suggestions_riskProfileId_fkey` FOREIGN KEY (`riskProfileId`) REFERENCES `risk_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forecast_scenarios` ADD CONSTRAINT `forecast_scenarios_shopProfileId_fkey` FOREIGN KEY (`shopProfileId`) REFERENCES `shop_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forecast_affected_items` ADD CONSTRAINT `forecast_affected_items_forecastScenarioId_fkey` FOREIGN KEY (`forecastScenarioId`) REFERENCES `forecast_scenarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `location_profiles` ADD CONSTRAINT `location_profiles_shopProfileId_fkey` FOREIGN KEY (`shopProfileId`) REFERENCES `shop_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lrdb_officers` ADD CONSTRAINT `lrdb_officers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `queries` ADD CONSTRAINT `queries_submittedByUserId_fkey` FOREIGN KEY (`submittedByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `queries` ADD CONSTRAINT `queries_assignedToUserId_fkey` FOREIGN KEY (`assignedToUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `query_status_history` ADD CONSTRAINT `query_status_history_queryId_fkey` FOREIGN KEY (`queryId`) REFERENCES `queries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `report_metrics` ADD CONSTRAINT `report_metrics_disasterReportId_fkey` FOREIGN KEY (`disasterReportId`) REFERENCES `disaster_reports`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_group_members` ADD CONSTRAINT `chat_group_members_chatGroupId_fkey` FOREIGN KEY (`chatGroupId`) REFERENCES `chat_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_group_members` ADD CONSTRAINT `chat_group_members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_labels` ADD CONSTRAINT `chat_labels_chatGroupId_fkey` FOREIGN KEY (`chatGroupId`) REFERENCES `chat_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_logs` ADD CONSTRAINT `notification_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
