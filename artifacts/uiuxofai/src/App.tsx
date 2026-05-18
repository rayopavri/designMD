import { Route, Router as WouterRouter, Switch } from "wouter";
import { Shell } from "./components/Shell";
import { Home } from "./pages/Home";
import { Library } from "./pages/Library";
import { BundleDetail } from "./pages/BundleDetail";
import { Generate } from "./pages/Generate";
import { Vote } from "./pages/Vote";
import { VoteIndex } from "./pages/VoteIndex";
import { CopySuccess } from "./pages/CopySuccess";
import NotFound from "./pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/library" component={Library} />
      <Route path="/library/:id" component={BundleDetail} />
      <Route path="/copy/:id" component={CopySuccess} />
      <Route path="/generate" component={Generate} />
      <Route path="/vote" component={VoteIndex} />
      <Route path="/vote/:id" component={Vote} />
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
