import { Redirect, Route, Router as WouterRouter, Switch, useRoute } from "wouter";
import { Shell } from "./components/Shell";
import { Home } from "./pages/Home";
import { Library } from "./pages/Library";
import { LibraryType } from "./pages/LibraryType";
import { BundleDetail } from "./pages/BundleDetail";
import { Generate } from "./pages/Generate";
import { CopySuccess } from "./pages/CopySuccess";
import { CliDocs } from "./pages/CliDocs";
import NotFound from "./pages/not-found";
import { getItem } from "./lib/items";

function VoteItemRedirect() {
  const [, params] = useRoute<{ id: string }>("/vote/:id");
  const id = params?.id;
  const item = id ? getItem(id) : undefined;
  return <Redirect to={item ? `/library/${item.id}` : "/library/skills"} replace />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/library" component={Library} />
      <Route path="/library/skills" component={() => <LibraryType type="skill" />} />
      <Route path="/library/agents" component={() => <LibraryType type="agent" />} />
      <Route path="/library/mcps" component={() => <LibraryType type="mcp" />} />
      <Route path="/library/bundles" component={() => <Redirect to="/library/skills?ds=1" replace />} />
      <Route path="/library/:id" component={BundleDetail} />
      <Route path="/copy/:id" component={CopySuccess} />
      <Route path="/generate" component={Generate} />
      <Route path="/docs/cli" component={CliDocs} />
      <Route path="/vote" component={() => <Redirect to="/library/skills" replace />} />
      <Route path="/vote/:id" component={VoteItemRedirect} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Shell>
        <Router />
      </Shell>
    </WouterRouter>
  );
}

export default App;
