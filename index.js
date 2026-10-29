import i18next from "i18next";
import { autorun, reaction, runInAction } from "mobx";
import ConsoleAnalytics from "terriajs/lib/Core/Analytics/ConsoleAnalytics";
import GoogleAnalytics from "terriajs/lib/Core/Analytics/GoogleAnalytics";
import registerCatalogMembers from "terriajs/lib/Models/Catalog/registerCatalogMembers";
import CommonStrata from "terriajs/lib/Models/Definition/CommonStrata";
import createStratumInstance from "terriajs/lib/Models/Definition/createStratumInstance";
import NominatimSearchProvider from "terriajs/lib/Models/SearchProviders/NominatimSearchProvider";
import registerSearchProviders from "terriajs/lib/Models/SearchProviders/registerSearchProviders";
import ShareDataService from "terriajs/lib/Models/ShareDataService";
import Terria from "terriajs/lib/Models/Terria";
import ViewState from "terriajs/lib/ReactViewModels/ViewState";
import registerCustomComponentTypes from "terriajs/lib/ReactViews/Custom/registerCustomComponentTypes";
import { FeatureInfoTemplateTraits } from "terriajs/lib/Traits/TraitsClasses/FeatureInfoTraits";
import updateApplicationOnHashChange from "terriajs/lib/ViewModels/updateApplicationOnHashChange";
import updateApplicationOnMessageFromParentWindow from "terriajs/lib/ViewModels/updateApplicationOnMessageFromParentWindow";
import loadPlugins from "./lib/Core/loadPlugins";
import showGlobalDisclaimer from "./lib/Views/showGlobalDisclaimer";
import plugins from "./plugins";

const terriaOptions = {
  baseUrl: "build/TerriaJS"
};

// we check exact match for development to reduce chances that production flag isn't set on builds(?)
if (process.env.NODE_ENV === "development") {
  terriaOptions.analytics = new ConsoleAnalytics();
} else {
  terriaOptions.analytics = new GoogleAnalytics();
}

// Construct the TerriaJS application, arrange to show errors to the user, and start it up.
const terria = new Terria(terriaOptions);

// Create the ViewState before terria.start so that errors have somewhere to go.
const viewState = new ViewState({
  terria: terria
});

// Register all types of catalog members in the core TerriaJS.  If you only want to register a subset of them
// (i.e. to reduce the size of your application if you don't actually use them all), feel free to copy a subset of
// the code in the registerCatalogMembers function here instead.
registerCatalogMembers();

// Register custom search providers in the core TerriaJS. If you only want to register a subset of them, or to add your own,
// insert your custom version of the code in the registerSearchProviders function here instead.
registerSearchProviders();

// Register custom components in the core TerriaJS.  If you only want to register a subset of them, or to add your own,
// insert your custom version of the code in the registerCustomComponentTypes function here instead.
registerCustomComponentTypes(terria);

if (process.env.NODE_ENV === "development") {
  window.viewState = viewState;
}

const TRANSLATE_PREFIX = "translate#";
const TRANSLATE_TOKEN = /translate#([\w.]+)/g;

// TerriaJS shows catalog names and descriptions as they are written in the
// init file. Names and descriptions written as "translate#key" are translated
// here (keys live in wwwroot/languages/<lng>/languageOverrides.json).
// The name and template of a feature info template can contain
// "translate#key" tokens among the Mustache tags; each token is replaced by
// its translation.
function translateCatalog() {
  const visit = (model) => {
    const definition = model.strata.get(CommonStrata.definition);
    ["name", "description"].forEach((trait) => {
      const value = definition?.[trait];
      if (typeof value === "string" && value.startsWith(TRANSLATE_PREFIX)) {
        const text = i18next.t(value.slice(TRANSLATE_PREFIX.length));
        model.setTrait(CommonStrata.override, trait, text);
        // Items loaded from a reference (e.g. ckan-item) copy the name once
        model.target?.setTrait(CommonStrata.override, trait, text);
      }
    });
    const featureInfoTemplate = {};
    ["name", "template"].forEach((trait) => {
      const value = definition?.featureInfoTemplate?.[trait];
      if (typeof value === "string" && value.includes(TRANSLATE_PREFIX)) {
        featureInfoTemplate[trait] = value.replace(TRANSLATE_TOKEN, (_, key) =>
          i18next.t(key)
        );
      }
    });
    if (Object.keys(featureInfoTemplate).length > 0) {
      model.setTrait(
        CommonStrata.override,
        "featureInfoTemplate",
        createStratumInstance(FeatureInfoTemplateTraits, featureInfoTemplate)
      );
    }
    model.memberModels?.forEach(visit);
  };
  visit(terria.catalog.group);
}

// Story scenes of the init file can be written with "translate#key" titles
// and texts too. Their keys are kept by scene id, so scenes captured by the
// user are left as they are.
const storyKeys = new Map();
function translateStories() {
  terria.stories.forEach((story) => {
    if (!storyKeys.has(story.id) && story.title?.startsWith(TRANSLATE_PREFIX)) {
      storyKeys.set(story.id, { title: story.title, text: story.text });
    }
  });
  const t = (value) =>
    value?.startsWith(TRANSLATE_PREFIX)
      ? i18next.t(value.slice(TRANSLATE_PREFIX.length))
      : value;
  runInAction(() => {
    terria.stories = terria.stories.map((story) => {
      const keys = storyKeys.get(story.id);
      return keys
        ? { ...story, title: t(keys.title), text: t(keys.text) }
        : story;
    });
  });
}

export default terria
  .start({
    applicationUrl: window.location,
    configUrl: "config.json",
    shareDataService: new ShareDataService({
      terria: terria
    }),
    beforeRestoreAppState: () => {
      // Load plugins before restoring app state because app state may
      // reference plugin components and catalog items.
      return loadPlugins(viewState, plugins).catch((error) => {
        console.error(`Error loading plugins`);
        console.error(error);
      });
    }
  })
  .catch(function (e) {
    terria.raiseErrorToUser(e);
  })
  .finally(function () {
    // Override the default document title with appName. Check first for default
    // title, because user might have already customized the title in
    // index.ejs
    if (document.title === "Terria Map") {
      document.title = terria.appName;
    }

    // Load init sources like init files and share links
    terria.loadInitSources().then((result) => {
      result.raiseError(terria);
      const translate = () => {
        translateCatalog();
        translateStories();
        // The welcome message shows the video title from config.json as is
        runInAction(() => {
          terria.configParameters.welcomeMessageVideo.videoTitle = i18next.t(
            "gettingstarted.title"
          );
        });
      };
      translate();
      i18next.on("languageChanged", translate);

      // On the first visit TerriaJS opens the story prompt on top of the
      // welcome message. Hold the prompt back and ask once the welcome
      // message is closed.
      const notifications = terria.notificationState;
      autorun(() => {
        if (
          viewState.showWelcomeMessage &&
          notifications.currentNotification?.type === "story"
        ) {
          notifications.dismissCurrentNotification();
        }
      });
      reaction(
        () => viewState.showWelcomeMessage,
        (shown, wasShown) => {
          if (wasShown && !shown && !viewState.storyShown) {
            runInAction(() => terria.storyPromptShown++);
          }
        }
      );
    });

    try {
      // Automatically update Terria (load new catalogs, etc.) when the hash part of the URL changes.
      updateApplicationOnHashChange(terria, window);
      updateApplicationOnMessageFromParentWindow(terria, window);

      // Show a modal disclaimer before user can do anything else.
      if (terria.configParameters.globalDisclaimer) {
        showGlobalDisclaimer(viewState);
      }

      // Add font-imports
      const fontImports = terria.configParameters.theme?.fontImports;
      if (fontImports) {
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = fontImports;
        document.head.appendChild(styleSheet);
      }

      // Nominatim returns place names in the browser language; ask for the
      // interface language instead, and follow language switches.
      const setSearchLanguage = () => {
        const language = i18next.resolvedLanguage ?? i18next.language;
        terria.searchBarModel.locationSearchProvidersArray
          .filter((provider) => provider.type === NominatimSearchProvider.type)
          .forEach((provider) => {
            const url = new URL(provider.url);
            url.searchParams.set("accept-language", language);
            provider.setTrait(CommonStrata.override, "url", url.toString());
          });
      };
      setSearchLanguage();
      i18next.on("languageChanged", setSearchLanguage);
    } catch (e) {
      console.error(e);
      console.error(e.stack);
    }
  })
  .then(() => {
    return { terria, viewState };
  });
