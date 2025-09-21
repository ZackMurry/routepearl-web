import 'dotenv/config'

const testKey = process.env.CANVAS_TEST_KEY
const canvasDomain = 'https://umsystem.instructure.com'

const coursesResponse = await fetch(
  `${canvasDomain}/api/v1/courses?enrollment_state=active`,
  {
    headers: { Authorization: `Bearer ${testKey}` },
  },
)
const courses = await coursesResponse.json()
// console.log(courses)

const courseIds = courses.map((c) => c.id)

const courseId = courseIds[2]
console.log(courses[2])
console.log(courses[2].name)
console.log(courseId)

const assignmentsResponse = await fetch(
  `${canvasDomain}/api/v1/courses/${courseId}/assignments?enrollment_state=active`,
  {
    headers: { Authorization: `Bearer ${testKey}` },
  },
)
const assns = await assignmentsResponse.json()
console.log(assns)
console.log(assns.map((a) => a.name))

// Assignments, discussion posts, quizzes, exams
