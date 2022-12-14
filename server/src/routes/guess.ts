import { FastifyInstance } from "fastify"
import { z } from "zod"
import { prisma } from "../lib/prisma"
import { authenticate } from "../plugins/authenticate"


export async function guessRoutes(fastify: FastifyInstance) {
	fastify.get('/guesses/count', async () => {
		const count = await prisma.guess.count()

		return { count }
	})

	fastify.post("/polls/:pollId/games/:gameId/guess", { onRequest: [authenticate] }, async (request, reply) => {

		const createGuessParams = z.object({
			pollId: z.string(),
			gameId: z.string(),
		})

		const createGuessBody = z.object({
			firstTeamScore: z.number(),
			secondTeamScore: z.number(),
		})

		const { pollId, gameId } = createGuessParams.parse(request.params)
		const { firstTeamScore, secondTeamScore } = createGuessBody.parse(request.body)

		const participant = await prisma.participant.findUnique({
			where: {
				userId_pollId: {
					pollId,
					userId: request.user.sub
				}
			}
		})
		if (!participant)
			return reply.code(400).send({ message: "Você não pode palpitar neste bolão." })

		const guess = await prisma.guess.findUnique({
			where: {
				participantId_gameId: {
					participantId: participant.id,
					gameId
				}
			}
		})
		if (guess)
			return reply.code(400).send({ message: "Você ja palpitou este jogo neste bolão." })

		const game = await prisma.game.findUnique({
			where: {
				id: gameId
			}
		})
		if (!game)
			return reply.code(400).send({ message: "Jogo não encontrado." })
		if (game.date < new Date())
			return reply.code(400).send({ message: "Jogo aconteceu. Palpites fechados" })

		await prisma.guess.create({
			data: {
				gameId,
				participantId: participant.id,
				firstTeamScore,
				secondTeamScore,
			}
		})

		return reply.status(201).send()
	})


}
