CREATE TYPE "public"."category_source" AS ENUM('thm', 'derived', 'manual');--> statement-breakpoint
CREATE TYPE "public"."progress_status" AS ENUM('todo', 'in_progress', 'done');--> statement-breakpoint
CREATE TYPE "public"."step_room_requirement" AS ENUM('core', 'optional', 'bonus');--> statement-breakpoint
CREATE TYPE "public"."tag_kind" AS ENUM('technology', 'tool', 'skill');--> statement-breakpoint
CREATE TYPE "public"."track_level" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_id" integer,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "difficulties" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "difficulties_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"label" text NOT NULL,
	"level" smallint NOT NULL,
	CONSTRAINT "difficulties_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "import_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "import_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"dataset_version" text NOT NULL,
	"checksum" text NOT NULL,
	"rooms_seen" integer DEFAULT 0 NOT NULL,
	"added" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"deactivated" integer DEFAULT 0 NOT NULL,
	"report" jsonb
);
--> statement-breakpoint
CREATE TABLE "room_categories" (
	"room_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"source" "category_source" NOT NULL,
	"confidence" numeric(4, 3),
	CONSTRAINT "room_categories_room_id_category_id_pk" PRIMARY KEY("room_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "room_tags" (
	"room_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "room_tags_room_id_tag_id_pk" PRIMARY KEY("room_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "room_teams" (
	"room_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	CONSTRAINT "room_teams_room_id_team_id_pk" PRIMARY KEY("room_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "room_types" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "room_types_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "room_types_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rooms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"difficulty_id" integer NOT NULL,
	"room_type_id" integer NOT NULL,
	"duration_minutes" integer,
	"users_count" integer,
	"published_at" date,
	"thm_url" text NOT NULL,
	"is_free" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw" jsonb NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', "rooms"."title"), 'A') || setweight(to_tsvector('english', coalesce("rooms"."description", '')), 'B')) STORED,
	CONSTRAINT "rooms_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "step_rooms" (
	"step_id" integer NOT NULL,
	"room_id" integer NOT NULL,
	"position" integer NOT NULL,
	"requirement" "step_room_requirement" DEFAULT 'core' NOT NULL,
	"note" text,
	CONSTRAINT "step_rooms_step_id_room_id_pk" PRIMARY KEY("step_id","room_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" "tag_kind" NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "teams_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"label" text NOT NULL,
	"color" text NOT NULL,
	CONSTRAINT "teams_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "track_steps" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "track_steps_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"track_id" integer NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"objective" text,
	"estimated_minutes" integer
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tracks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"level" "track_level" NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	CONSTRAINT "tracks_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_room_progress" (
	"user_id" uuid NOT NULL,
	"room_id" integer NOT NULL,
	"status" "progress_status" DEFAULT 'todo' NOT NULL,
	"completed_at" timestamp with time zone,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_room_progress_user_id_room_id_pk" PRIMARY KEY("user_id","room_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_categories" ADD CONSTRAINT "room_categories_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_categories" ADD CONSTRAINT "room_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_tags" ADD CONSTRAINT "room_tags_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_tags" ADD CONSTRAINT "room_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_teams" ADD CONSTRAINT "room_teams_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_teams" ADD CONSTRAINT "room_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_difficulty_id_difficulties_id_fk" FOREIGN KEY ("difficulty_id") REFERENCES "public"."difficulties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_rooms" ADD CONSTRAINT "step_rooms_step_id_track_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."track_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_rooms" ADD CONSTRAINT "step_rooms_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_steps" ADD CONSTRAINT "track_steps_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_room_progress" ADD CONSTRAINT "user_room_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_room_progress" ADD CONSTRAINT "user_room_progress_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "room_categories_category_id_idx" ON "room_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "room_tags_tag_id_idx" ON "room_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "room_teams_team_id_idx" ON "room_teams" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "rooms_search_vector_idx" ON "rooms" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "rooms_title_trgm_idx" ON "rooms" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "rooms_difficulty_id_idx" ON "rooms" USING btree ("difficulty_id");--> statement-breakpoint
CREATE INDEX "rooms_room_type_id_idx" ON "rooms" USING btree ("room_type_id");--> statement-breakpoint
CREATE INDEX "rooms_active_free_idx" ON "rooms" USING btree ("is_active","is_free");--> statement-breakpoint
CREATE INDEX "rooms_users_count_idx" ON "rooms" USING btree ("users_count");--> statement-breakpoint
CREATE INDEX "step_rooms_room_id_idx" ON "step_rooms" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_kind_slug_idx" ON "tags" USING btree ("kind","slug");--> statement-breakpoint
CREATE INDEX "tags_kind_idx" ON "tags" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "track_steps_track_position_idx" ON "track_steps" USING btree ("track_id","position");--> statement-breakpoint
CREATE INDEX "user_room_progress_room_id_idx" ON "user_room_progress" USING btree ("room_id");