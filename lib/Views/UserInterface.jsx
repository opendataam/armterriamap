import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import MobileMenuItem from "terriajs/lib/ReactViews/Mobile/MobileMenuItem";
import RelatedMaps from "terriajs/lib/ReactViews/RelatedMaps/RelatedMaps";
import { MenuLeft } from "terriajs/lib/ReactViews/StandardUserInterface/customizable/Groups";
import MenuButton from "terriajs/lib/ReactViews/StandardUserInterface/customizable/MenuButton";
import responsiveSwitch from "terriajs/lib/ReactViews/StandardUserInterface/customizable/ResponsiveSwitch";
import StandardUserInterface from "terriajs/lib/ReactViews/StandardUserInterface/StandardUserInterface";
import version from "../../version";

// TerriaJS's MenuItem renders an empty item in the mobile menu: it passes
// caption and href to MobileMenuItem, which renders only its children.
const MobileMenuLink = ({ caption, href }) => (
  <MobileMenuItem>
    <MobileMenuItem.Link href={href}>{caption}</MobileMenuItem.Link>
  </MobileMenuItem>
);

MobileMenuLink.propTypes = {
  caption: PropTypes.string.isRequired,
  href: PropTypes.string.isRequired
};

const MenuLink = responsiveSwitch(MenuButton, MobileMenuLink);

export const TerriaUserInterface = ({ terria, viewState, themeOverrides }) => {
  const { t } = useTranslation();
  const relatedMaps = viewState.terria.configParameters.relatedMaps;
  const aboutButtonHrefUrl =
    viewState.terria.configParameters.aboutButtonHrefUrl;

  return (
    <StandardUserInterface
      terria={terria}
      viewState={viewState}
      themeOverrides={themeOverrides}
      version={version}
    >
      <MenuLeft>
        <MenuLink
          caption={t("projectLink.caption")}
          href="https://opendata.am"
          key="project-link"
        />
        {aboutButtonHrefUrl ? (
          <MenuLink
            caption={t("aboutButton.caption")}
            href={aboutButtonHrefUrl}
            key="about-link"
          />
        ) : null}
        {relatedMaps && relatedMaps.length > 0 ? (
          <RelatedMaps relatedMaps={relatedMaps} />
        ) : null}
      </MenuLeft>
    </StandardUserInterface>
  );
};

TerriaUserInterface.propTypes = {
  terria: PropTypes.object.isRequired,
  viewState: PropTypes.object.isRequired,
  themeOverrides: PropTypes.object
};
