import {SxProps, Theme} from '@mui/material';

export const toolbarOutlinedButtonSx: SxProps<Theme> = {
    color: 'inherit',
    borderColor: 'rgba(255,255,255,0.5)',
    '&:hover': {borderColor: 'inherit', bgcolor: 'rgba(255,255,255,0.1)'},
};

export const toolbarIconButtonSx: SxProps<Theme> = {
    color: 'inherit',
    ml: 1,
};
