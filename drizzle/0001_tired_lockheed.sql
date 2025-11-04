CREATE TABLE "vercel_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"vercel_project_id" text NOT NULL,
	"name" text NOT NULL,
	"framework" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "vercel_api_token" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "vercel_team_id" text;--> statement-breakpoint
ALTER TABLE "workflows" ADD COLUMN "vercel_project_id" text;--> statement-breakpoint
ALTER TABLE "vercel_projects" ADD CONSTRAINT "vercel_projects_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_vercel_project_id_vercel_projects_id_fk" FOREIGN KEY ("vercel_project_id") REFERENCES "public"."vercel_projects"("id") ON DELETE no action ON UPDATE no action;