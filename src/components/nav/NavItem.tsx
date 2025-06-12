import { Flex, FlexProps, Text } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { FONT_FAMILIES } from "@/utils/font";
import { colors } from "@/utils/colors";
import { RouteButton, ROUTES } from "@/utils/types";

interface NavItemProps extends FlexProps {
  buttonName: RouteButton;
}
const NavItem: React.FC<NavItemProps> = ({ buttonName, onClick }) => {
  const router = useRouter();

  console.log("router", router);
  const tabUrl = ROUTES[buttonName];
  const selectedUrl = router.asPath;

  const isSelected = selectedUrl == tabUrl;

  return (
    <Flex
      onClick={onClick}
      bgGradient={isSelected ? colors.gradient.title : undefined}
      opacity={isSelected ? 1 : 0.5}
      px="15px"
      py="10px"
      borderRadius="10px"
      w="100%"
      transition="0.2s ease-in-out all"
    >
      <Text fontFamily={FONT_FAMILIES.NOSTROMO} fontSize="24px" color="white">
        {buttonName}
      </Text>
    </Flex>
  );
};

export default NavItem;
