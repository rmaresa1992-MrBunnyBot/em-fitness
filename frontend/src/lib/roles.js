// EM Fitness: who sees the athlete's app (D14). An athlete is a signed-in account that is not the
// trainer. Guests (no account) keep upstream's free app: nobody coaches them.
export const isAthlete = user => !!user && !user.admin
