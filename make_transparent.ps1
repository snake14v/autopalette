Add-Type -AssemblyName System.Drawing
$imgPath = "c:\Users\VAISHAK\Desktop\ol websites\autopalette\public\logo.png"
# Create a temporary copy to release file lock when reading
$tmpImg = [System.Drawing.Image]::FromFile($imgPath)
$bmp = New-Object System.Drawing.Bitmap($tmpImg)
$tmpImg.Dispose()

$bmp.MakeTransparent([System.Drawing.Color]::White)
# Some pixels might be slightly off white, let's do a fast loop to clear pixels close to white
for ($x = 0; $x -lt $bmp.Width; $x++) {
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.R -gt 240 -and $c.G -gt 240 -and $c.B -gt 240) {
            $bmp.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
        }
    }
}
$bmp.Save($imgPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "Logo transparency completed."
