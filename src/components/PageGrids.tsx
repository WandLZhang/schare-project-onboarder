import React from 'react';
import { Box, Paper, SxProps, Theme } from '@mui/material';
import { styled } from '@mui/material/styles';

// Custom styled components to replace Grid
export const GridContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  margin: theme.spacing(-1.5),
  width: 'calc(100% + 24px)', // To account for the margin
}));

interface GridItemProps {
  xs?: number;
  md?: number;
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}

export const GridItem: React.FC<GridItemProps> = ({ 
  xs = 12, 
  md, 
  children, 
  sx = {} 
}) => {
  const getWidth = (columns: number) => `${(columns / 12) * 100}%`;
  
  return (
    <Box 
      sx={{
        padding: 1.5,
        width: '100%',
        [md ? 'width' : '']: xs === 12 ? '100%' : getWidth(xs),
        [`@media (min-width: ${600}px)`]: md ? {
          width: md === 12 ? '100%' : getWidth(md)
        } : {},
        ...sx
      }}
    >
      {children}
    </Box>
  );
};

// Paper with consistent styling
export const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  height: '100%'
}));
