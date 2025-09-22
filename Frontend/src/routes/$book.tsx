import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$book")({
  component: RouteComponent,
});

function RouteComponent() {
  const { book } = Route.useParams();
  return <div>Hello {book} !</div>;
}
