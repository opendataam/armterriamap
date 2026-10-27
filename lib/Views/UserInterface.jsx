import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import RelatedMaps from "terriajs/lib/ReactViews/RelatedMaps/RelatedMaps";
import { MenuLeft } from "terriajs/lib/ReactViews/StandardUserInterface/customizable/Groups";
import MenuItem from "terriajs/lib/ReactViews/StandardUserInterface/customizable/MenuItem";
import StandardUserInterface from "terriajs/lib/ReactViews/StandardUserInterface/StandardUserInterface";
import version from "../../version";

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
        {aboutButtonHrefUrl ? (
          <MenuItem
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
