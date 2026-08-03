/**
 * Prisma has been removed from the Vercel/web runtime.
 * All farm data access goes through Nest (`@/lib/hatchlog-api`).
 * Keep this stub so accidental imports fail loudly in development.
 */
export default new Proxy(
  {},
  {
    get() {
      throw new Error(
        'Prisma is not available on the web app. Use Nest via @/lib/hatchlog-api.',
      )
    },
  },
) as never
