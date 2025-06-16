import { Text, TextProps } from '@chakra-ui/react';
import { colors } from '../../utils/colors';

const OrangeText: React.FC<TextProps> = ({ children, ...props }) => {
    return (
        <Text fontWeight={'bold'} as='span' color={colors.text.orange} {...props}>
            {children}
        </Text>
    );
};

export default OrangeText;
