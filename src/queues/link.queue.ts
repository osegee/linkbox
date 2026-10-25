import { Queue, Worker } from "bullmq";
import { redisConnection } from "../config/redis";
import { prisma } from "../config/prisma";
import { scrapeUrlMetadata } from "../utils/scraper";


const QUEUE_NAME = "link-Queue";


export const linkQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});


export const linkWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { linkId, url } = job.data;
    console.log(`Scraping started for: ${url}`);

    
    const metadata = await scrapeUrlMetadata(url);

    
    await prisma.link.update({
      where: { id: linkId },
      data: {
        title: metadata.title,
        description: metadata.description,
        imageUrl: metadata.imageUrl,
        siteName: metadata.siteName,
        status: "READY",
      },
    });

    console.log(`Scraping finished for: ${url}`);
  },
  {
    connection: redisConnection,
  },
);

linkWorker.on("failed", async (job, err) => {
  console.error(`❌ Scraping failed for job ${job?.id}:`, err.message);

  if (job && job.attemptsMade >= 3) {
    await prisma.link.update({
      where: { id: job.data.linkId },
      data: { status: "FAILED" },
    });
  }
});
