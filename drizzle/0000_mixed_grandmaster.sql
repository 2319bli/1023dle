CREATE TABLE `daily_scores` (
	`date` text NOT NULL,
	`player_id` text NOT NULL,
	`moves` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`date`, `player_id`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `daily_ranking` ON `daily_scores` (`date`,`moves`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_token_hash_unique` ON `players` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `players_nickname` ON `players` ("nickname" COLLATE NOCASE);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`bucket` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_expiry` ON `rate_limits` (`expires`);--> statement-breakpoint
CREATE TABLE `rounds` (
	`run_id` text NOT NULL,
	`round` integer NOT NULL,
	`path_hash` text NOT NULL,
	`response` text NOT NULL,
	PRIMARY KEY(`run_id`, `round`),
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`seed` text NOT NULL,
	`round` integer NOT NULL,
	`cleared` integer NOT NULL,
	`ended` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `runs_player` ON `runs` (`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `one_active_run` ON `runs` (`player_id`) WHERE "runs"."ended" = 0;