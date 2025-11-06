import React from "react";
import Header from "next/head";
import { NextPage } from "next";
import { colors } from "../../utils/colors";

export interface Props {
  title?: string;
  embed?: { image: string };
  owner?: string;
  additionalKeywords?: string[];
  description?: string;
}

const DESCRIPTION = "Rift - The first peer-to-peer Bitcoin exchange.";
const DEFAULT_IMAGE = "/images/PreviewArt.png";

export const OpenGraph: NextPage<Props> = ({
  title,
  description = DESCRIPTION,
  owner,
  additionalKeywords = [],
  embed = { image: DEFAULT_IMAGE },
}) => {
  if (!description) description = DESCRIPTION;
  return (
    <Header>
      {title ? <title>{title} • Rift</title> : <title>Rift</title>}
      <meta name="description" content={description} />
      {owner ? <meta name="author" content={owner} /> : ""}
      <meta
        name="keywords"
        content={`Rift, Bridge, Ethereum, Bitcoin, Swap, Decentralized Exchange, DEX, ${additionalKeywords?.map((k) => `, ${k}`)}`}
      />
      <meta name="theme-color" content={colors.RiftOrange} />
      {embed ? (
        <>
          <meta name="og:title" content={title || "Rift"} />
          <meta name="og:type" content="website" />
          {owner ? <meta name="music:creator" content={owner} /> : ""}
          <meta name="og:description" content={description} />
          <meta name="og:site_name" content="Rift" />
          <meta name="og:image" content={embed ? embed.image : DEFAULT_IMAGE} />
        </>
      ) : (
        ""
      )}
    </Header>
  );
};
