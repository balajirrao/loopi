/**
 * ! Executing this script will delete all data in your database and seed it with 10 users.
 * ! Make sure to adjust the script to your needs.
 * Use any TypeScript runner to run this script, for example: `npx tsx seed.ts`
 * Learn more about the Seed Client by following our guide: https://docs.snaplet.dev/seed/getting-started
 */
import { createSeedClient } from "@snaplet/seed";
import bcrypt from "bcryptjs";

const main = async () => {
  const seed = await createSeedClient();

  // Truncate all tables in the database
  await seed.$resetDatabase();

  const primaryUserPassword = "LoopiDemo1!";
  const primaryUserPasswordHash = bcrypt.hashSync(primaryUserPassword, 10);
  // Seed the primary demo user with deterministic data
  const primaryUserId = "00e51f8f-6e8a-4c0a-aa17-519f93bc2dc8";
  const { users: primaryUsers } = await seed.users([
    {
      id: primaryUserId,
      instance_id: "00000000-0000-0000-0000-000000000000",
      aud: "authenticated",
      role: "authenticated",
      email: "a@a.com",
      email_confirmed_at: "2025-11-10T12:06:59.110009+00",
      created_at: "2025-11-10T12:06:59.104333+00",
      updated_at: "2025-11-10T12:06:59.110529+00",
      encrypted_password: primaryUserPasswordHash,
      raw_app_meta_data: {
        provider: "email",
        providers: ["email"],
      },
      raw_user_meta_data: {
        email_verified: true,
      },
      banned_until: null,
      is_anonymous: false,
      is_sso_user: false,
    },
  ]);

  // Seed the database with additional sample users
  await seed.users((x) => x(9));

  const primaryUser = primaryUsers?.[0];

  if (primaryUser) {
    await seed.routine_templates([
      {
        name: "Evening Routine",
        default_end_time: "20:30",
        users: ({ connect }) => connect({ id: primaryUser.id }),
        routine_template_tasks: [
          { title: "Play Game", target_offset_minutes: 10 },
          { title: "Brush Teeth", target_offset_minutes: 15 },
          { title: "Desert", target_offset_minutes: 30 },
          { title: "Dry Fruits", target_offset_minutes: null },
        ],
      },
    ]);
  }

  // Type completion not working? You might want to reload your TypeScript Server to pick up the changes

  console.log("Database seeded successfully!");
  console.log(`Primary account -> email: a@a.com password: ${primaryUserPassword}`);

  process.exit();
};

main();
